/**
 * Mock tool registry for the eval harness.
 *
 * Mirrors the real agent's tool catalog (`src/lib/agent/tools/*`) but
 * with two critical differences:
 *
 *  1. No `"server-only"` import — eval runs under `tsx` outside Next.
 *  2. Implementations operate on an in-memory `MockState` instead of
 *     hitting Supabase. Each test case spins up its own state so cases
 *     don't bleed into each other.
 *
 * Schemas + descriptions are kept verbatim from the real tools so the
 * model sees the same surface area. If you add a tool to the real
 * registry, add a mock here too — the eval is meant to catch behavior
 * regressions, not skip them.
 *
 * State + tool calls are captured into `CallRecorder` so the runner
 * can reconstruct the agent's exact sequence afterwards.
 */

import { tool, type ToolSet } from "ai";
import { z } from "zod";

// ── Fixtures ───────────────────────────────────────────────────────────

export type TodoFixture = {
  id: string;
  text: string;
  /** ISO 8601 (+07:00) or null. */
  due_at: string | null;
  due_text: string | null;
  created_at: string;
  folder?: string | null;
};

export type UserMemoryFixture = Record<string, string>;

export type MockState = {
  /** Current pending list (server-side truth). */
  pending: TodoFixture[];
  /** Current done list. */
  done: TodoFixture[];
  /** Per-user memory. */
  userMemory: UserMemoryFixture;
  /** Position-cache flags — set when list_pending / list_done is called. */
  pendingListed: boolean;
  doneListed: boolean;
  /** Reply bubbles pushed via send_*_reply. */
  bubbles: { type: "text" | "flex"; text?: string; template?: string }[];
};

export function makeMockState(opts: {
  pending?: TodoFixture[];
  done?: TodoFixture[];
  userMemory?: UserMemoryFixture;
}): MockState {
  return {
    pending: opts.pending ? [...opts.pending] : [],
    done: opts.done ? [...opts.done] : [],
    userMemory: { ...(opts.userMemory ?? {}) },
    pendingListed: false,
    doneListed: false,
    bubbles: [],
  };
}

// ── Recorder ───────────────────────────────────────────────────────────

export type ToolCallRecord = {
  name: string;
  args: unknown;
  result: unknown;
};

export class CallRecorder {
  readonly calls: ToolCallRecord[] = [];
  record(name: string, args: unknown, result: unknown) {
    this.calls.push({ name, args, result });
  }
}

// ── Ambiguity guard (mirrors save_memory.ts) ───────────────────────────

const AMBIGUOUS_SAVE_TEXTS = new Set<string>([
  "ทดสอบ",
  "ทดสอบบอท",
  "test",
  "testing",
  "hi",
  "hello",
  "สวัสดี",
  "หวัดดี",
  "งาน",
  "todo",
  "อะไร",
  "ทำ",
  "บันทึก",
  "จด",
  "เตือน",
  "ลบ",
  "ลิส",
]);

function isAmbiguousSaveText(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  if (t.length < 2) return true;
  if (AMBIGUOUS_SAVE_TEXTS.has(t)) return true;
  return false;
}

// ── Tool factory ───────────────────────────────────────────────────────

const MAX_BUBBLES = 5;

/**
 * Build a Vercel AI SDK `ToolSet` bound to a specific state + recorder.
 * The shape + descriptions mirror `src/lib/agent/tools/*` 1:1.
 */
export function buildMockToolSet(state: MockState, rec: CallRecorder): ToolSet {
  function record<T>(name: string, args: unknown, result: T): T {
    rec.record(name, args, result);
    return result;
  }

  return {
    list_pending: tool({
      description:
        "Read user's open todos. Returns up to 20 items with position+text+due_at. Server caches the list — afterwards prefer *_by_position tools to mutate.",
      inputSchema: z.object({}).strict(),
      execute: async () => {
        state.pendingListed = true;
        return record("list_pending", {}, {
          ok: true,
          count: state.pending.length,
          items: state.pending.map((it, i) => ({
            position: i + 1,
            text: it.text,
            due_at: it.due_at,
            due_text: it.due_text,
            due_short: "",
            urgency_color: "#a08050",
          })),
        });
      },
    }),

    list_done: tool({
      description:
        "Read recently-completed todos. Use only to find a done item to uncomplete. Server caches the list; afterwards use uncomplete_by_position.",
      inputSchema: z.object({}).strict(),
      execute: async () => {
        state.doneListed = true;
        return record("list_done", {}, {
          ok: true,
          count: state.done.length,
          items: state.done.map((it, i) => ({
            position: i + 1,
            text: it.text,
            due_at: it.due_at,
          })),
        });
      },
    }),

    save_memory: tool({
      description: "Create a new todo/reminder. See system prompt §Decision Tree.",
      inputSchema: z.object({
        text: z.string().describe("Cleaned action; preserve user's language."),
        due_at: z
          .string()
          .nullish()
          .describe("ISO 8601 +07:00; default 09:00 if no time."),
        due_text: z
          .string()
          .nullish()
          .describe("User's raw temporal phrase (e.g. 'พรุ่งนี้')."),
      }),
      execute: async (input) => {
        if (isAmbiguousSaveText(input.text)) {
          return record("save_memory", input, {
            ok: false,
            reason: "ambiguous_text",
            message:
              "Text is too short or generic to save as a todo. Ask the user for more detail.",
          });
        }
        const id = `t_${state.pending.length + state.done.length + 1}`;
        const todo: TodoFixture = {
          id,
          text: input.text,
          due_at: input.due_at ?? null,
          due_text: input.due_text ?? null,
          created_at: new Date().toISOString(),
        };
        state.pending.push(todo);
        return record("save_memory", input, {
          ok: true,
          todoId: id,
          text: todo.text,
          dueAt: todo.due_at,
          dueText: todo.due_text,
        });
      },
    }),

    complete_by_position: tool({
      description:
        "Mark a pending todo done by 1-based position. If list_pending hasn't been called this turn, the server auto-fetches it before resolving the position.",
      inputSchema: z.object({
        position: z.number().int().min(1).describe("1-based position from list_pending output."),
      }),
      execute: async (input) => {
        // Auto-list mimic.
        if (!state.pendingListed) state.pendingListed = true;
        const item = state.pending[input.position - 1];
        if (!item) {
          return record("complete_by_position", input, {
            ok: false,
            reason: "out_of_range",
            message: `position ${input.position} not in pending list (size=${state.pending.length}).`,
          });
        }
        state.pending.splice(input.position - 1, 1);
        state.done.unshift(item);
        return record("complete_by_position", input, {
          ok: true,
          text: item.text,
          todoId: item.id,
          pending_count_left: state.pending.length,
        });
      },
    }),

    uncomplete_by_position: tool({
      description:
        "Re-open a completed todo by 1-based position. Use when user says 'undo' / 'ติ๊กผิด'. Server auto-fetches list_done if not called this turn.",
      inputSchema: z.object({
        position: z.number().int().min(1).describe("1-based position from list_done."),
      }),
      execute: async (input) => {
        if (!state.doneListed) state.doneListed = true;
        const item = state.done[input.position - 1];
        if (!item) {
          return record("uncomplete_by_position", input, {
            ok: false,
            reason: "out_of_range",
            message: `position ${input.position} not in done list.`,
          });
        }
        state.done.splice(input.position - 1, 1);
        state.pending.push(item);
        return record("uncomplete_by_position", input, {
          ok: true,
          text: item.text,
        });
      },
    }),

    update_by_position: tool({
      description:
        "Edit a pending todo by 1-based position. Pass only changed fields. Clear date = both due_at + due_text null. Server auto-fetches list_pending if needed.",
      inputSchema: z.object({
        position: z.number().int().min(1).describe("1-based position from list_pending."),
        text: z.string().nullish(),
        due_at: z.string().nullish(),
        due_text: z.string().nullish(),
      }),
      execute: async (input) => {
        if (!state.pendingListed) state.pendingListed = true;
        const item = state.pending[input.position - 1];
        if (!item) {
          return record("update_by_position", input, {
            ok: false,
            reason: "out_of_range",
            message: `position ${input.position} not in pending list.`,
          });
        }
        if (typeof input.text === "string") item.text = input.text;
        if (input.due_at === null) item.due_at = null;
        else if (typeof input.due_at === "string") item.due_at = input.due_at;
        if (input.due_text === null) item.due_text = null;
        else if (typeof input.due_text === "string") item.due_text = input.due_text;
        return record("update_by_position", input, {
          ok: true,
          text: item.text,
        });
      },
    }),

    delete_by_position: tool({
      description:
        "Permanently delete a pending todo by 1-based position. Irreversible. Server auto-fetches list_pending if not called this turn.",
      inputSchema: z.object({
        position: z.number().int().min(1).describe("1-based position from list_pending."),
      }),
      execute: async (input) => {
        if (!state.pendingListed) state.pendingListed = true;
        const item = state.pending[input.position - 1];
        if (!item) {
          return record("delete_by_position", input, {
            ok: false,
            reason: "out_of_range",
            message: `position ${input.position} not in pending list.`,
          });
        }
        state.pending.splice(input.position - 1, 1);
        return record("delete_by_position", input, {
          ok: true,
          text: item.text,
          remaining_count: state.pending.length,
        });
      },
    }),

    send_dashboard_link: tool({
      description:
        "Generate + reply with a one-tap LIFF launcher to the user's dashboard. Use when the user asks for a link, says 'เปิดเว็บ', or you've made many edits and want them to verify visually.",
      inputSchema: z.object({}).strict(),
      execute: async () => {
        // Eval-mode: pretend the link was sent; capture as a bubble so the
        // runner's bubble counter stays accurate.
        state.bubbles.push({ type: "flex", template: "dashboard_link" });
        return record("send_dashboard_link", {}, { ok: true, link_sent: true });
      },
    }),

    update_memory: tool({
      description:
        "Persist a stable fact about the user (e.g. timezone, preferred language, birthday). Do NOT use for todos.",
      inputSchema: z.object({
        key: z.string().min(1).max(64),
        value: z.string().min(1).max(512),
      }),
      execute: async (input) => {
        state.userMemory[input.key] = input.value;
        return record("update_memory", input, { ok: true });
      },
    }),

    save_note: tool({
      description:
        "Create a top-level note (appears in 'Recent Notes' on the dashboard). Use for URL captures and standalone notes — NOT for todos / reminders (use save_memory for those).",
      inputSchema: z.object({
        title: z.string().min(1).max(200),
        body: z.string().nullish(),
      }),
      execute: async (input) => {
        return record("save_note", input, {
          ok: true,
          noteId: `n_${Date.now()}`,
          title: input.title,
        });
      },
    }),

    send_text_reply: tool({
      description:
        "Send one chat bubble to the user. Call MULTIPLE times for multi-bubble replies. Max 5 bubbles per turn.",
      inputSchema: z.object({ text: z.string().min(1).max(500) }),
      execute: async (input) => {
        if (state.bubbles.length >= MAX_BUBBLES) {
          return record("send_text_reply", input, {
            ok: false,
            reason: "bubble_limit",
            message: `Bubble limit ${MAX_BUBBLES} reached.`,
          });
        }
        state.bubbles.push({ type: "text", text: input.text });
        return record("send_text_reply", input, {
          ok: true,
          bubble_index: state.bubbles.length,
          remaining: MAX_BUBBLES - state.bubbles.length,
        });
      },
    }),

    send_flex_reply: tool({
      description:
        "Reply with a designer-built Flex Message template. Templates: todo_saved, todo_deleted, todo_updated, todo_completed, todo_list, todo_empty, error_inline, multi_save_summary.",
      inputSchema: z.object({
        template: z.string().min(1),
        // Vars vary per template — accept anything and let the test
        // case assert.
        vars: z.record(z.string(), z.unknown()).optional(),
        alt_text: z.string().optional(),
      }),
      execute: async (input) => {
        if (state.bubbles.length >= MAX_BUBBLES) {
          return record("send_flex_reply", input, {
            ok: false,
            reason: "bubble_limit",
          });
        }
        state.bubbles.push({ type: "flex", template: input.template });
        return record("send_flex_reply", input, {
          ok: true,
          bubble_index: state.bubbles.length,
        });
      },
    }),
  };
}
