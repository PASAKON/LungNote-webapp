import "server-only";
import { saveMemoryRaw } from "@/lib/memory/save";
import { listPendingFromLine, listDoneFromLine } from "@/lib/memory/list";
import {
  completeMemory,
  deleteMemory,
  uncompleteMemory,
  updateMemory,
} from "@/lib/memory/mutate";
import { mintToken } from "@/lib/auth/line-link";

const SITE_URL = "https://lungnote.com";

/**
 * OpenAI/OpenRouter tool definitions for the LungNote chat agent — ADR-0012 Phase 2.
 *
 * Two tools are exposed:
 *   • save_memory   — create a todo/reminder row in lungnote_todos
 *   • list_pending  — return the user's open todos (sorted soonest-due first)
 *
 * The model decides when to call them. The reply loop (lib/ai/reply.ts) executes
 * the calls and feeds results back as tool messages. Anonymous (no LINE userId)
 * sessions get the tools stripped — there's no one to scope the data to.
 */
export const TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "save_memory",
      description:
        "Create a new todo/reminder. See system prompt §Decision Tree.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Cleaned action; preserve user's language." },
          due_at: { type: "string", description: "ISO 8601 +07:00; default 09:00 if no time." },
          due_text: { type: "string", description: "User's raw temporal phrase." },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_pending",
      description:
        "Read user's open todos. Returns up to 20 items with id+text+due_at. Use ids for complete/update/delete calls.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "complete_memory",
      description: "Mark todo done. Requires id from list_pending. Never invent ids.",
      parameters: {
        type: "object",
        properties: {
          todo_id: { type: "string", description: "id from list_pending." },
        },
        required: ["todo_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_done",
      description: "Read recently-completed todos. Use only to find id for uncomplete_memory.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "uncomplete_memory",
      description: "Re-open a done todo. Requires id from list_done.",
      parameters: {
        type: "object",
        properties: {
          todo_id: { type: "string", description: "id from list_done." },
        },
        required: ["todo_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_memory",
      description:
        "Edit todo text/date. Requires id. Pass only changed fields. Clear date = both due_at + due_text null.",
      parameters: {
        type: "object",
        properties: {
          todo_id: { type: "string", description: "id from list_pending/list_done." },
          text: { type: "string", description: "New text. Omit to keep." },
          due_at: { type: ["string", "null"], description: "ISO 8601 +07:00 or null to clear." },
          due_text: { type: ["string", "null"], description: "Raw phrase or null to clear." },
        },
        required: ["todo_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_dashboard_link",
      description:
        "Mint one-time web login URL (5min TTL). Call for 'dashboard'/'เว็บ'/'login'/'เปิดแอป' or to link unlinked users. Include URL verbatim in reply.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_memory",
      description:
        "Permanently delete a todo. Requires id from list_pending. Irreversible — ambiguous match = ask first.",
      parameters: {
        type: "object",
        properties: {
          todo_id: { type: "string", description: "id from list_pending." },
        },
        required: ["todo_id"],
      },
    },
  },
];

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ToolResult = {
  tool_call_id: string;
  content: string; // serialized JSON or human text the model can read back
};

/**
 * Dispatch a tool call to its implementation. Anonymous users get a refusal
 * message instead of executing — the model will incorporate it into its reply
 * and (we hope) tell the user to link their account.
 */
export async function executeToolCall(
  call: ToolCall,
  lineUserId: string | null,
): Promise<ToolResult> {
  if (!lineUserId) {
    return {
      tool_call_id: call.id,
      content: JSON.stringify({
        ok: false,
        reason: "not_linked",
        message:
          "User has not linked their LINE account. Tell them to type 'dashboard' to link.",
      }),
    };
  }

  try {
    const args = parseArgs(call.function.arguments);
    switch (call.function.name) {
      case "save_memory": {
        const text = typeof args.text === "string" ? args.text : "";
        const dueAt = normalizeIso(args.due_at);
        const dueText =
          typeof args.due_text === "string" && args.due_text.trim()
            ? args.due_text.trim().slice(0, 200)
            : null;
        const result = await saveMemoryRaw({
          lineUserId,
          text,
          dueAt,
          dueText,
        });
        return {
          tool_call_id: call.id,
          content: JSON.stringify(result),
        };
      }
      case "list_pending": {
        const result = await listPendingFromLine(lineUserId);
        return {
          tool_call_id: call.id,
          content: JSON.stringify(result),
        };
      }
      case "complete_memory": {
        const todoId = typeof args.todo_id === "string" ? args.todo_id : "";
        if (!todoId) {
          return {
            tool_call_id: call.id,
            content: JSON.stringify({ ok: false, reason: "missing_id" }),
          };
        }
        const invalid = ensureUuidId(call, todoId);
        if (invalid) return invalid;
        const result = await completeMemory(lineUserId, todoId);
        return { tool_call_id: call.id, content: JSON.stringify(result) };
      }
      case "delete_memory": {
        const todoId = typeof args.todo_id === "string" ? args.todo_id : "";
        if (!todoId) {
          return {
            tool_call_id: call.id,
            content: JSON.stringify({ ok: false, reason: "missing_id" }),
          };
        }
        const invalid = ensureUuidId(call, todoId);
        if (invalid) return invalid;
        const result = await deleteMemory(lineUserId, todoId);
        return { tool_call_id: call.id, content: JSON.stringify(result) };
      }
      case "list_done": {
        const result = await listDoneFromLine(lineUserId);
        return { tool_call_id: call.id, content: JSON.stringify(result) };
      }
      case "uncomplete_memory": {
        const todoId = typeof args.todo_id === "string" ? args.todo_id : "";
        if (!todoId) {
          return {
            tool_call_id: call.id,
            content: JSON.stringify({ ok: false, reason: "missing_id" }),
          };
        }
        const invalid = ensureUuidId(call, todoId);
        if (invalid) return invalid;
        const result = await uncompleteMemory(lineUserId, todoId);
        return { tool_call_id: call.id, content: JSON.stringify(result) };
      }
      case "send_dashboard_link": {
        try {
          const { token } = await mintToken(lineUserId);
          const url = `${SITE_URL}/auth/line?t=${token}`;
          return {
            tool_call_id: call.id,
            content: JSON.stringify({
              ok: true,
              url,
              expires_in_minutes: 5,
              instructions:
                "Reply naturally and include this URL on its own line so LINE auto-renders the link preview.",
            }),
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "unknown";
          return {
            tool_call_id: call.id,
            content: JSON.stringify({ ok: false, reason: "mint_failed", error: msg }),
          };
        }
      }
      case "update_memory": {
        const todoId = typeof args.todo_id === "string" ? args.todo_id : "";
        if (!todoId) {
          return {
            tool_call_id: call.id,
            content: JSON.stringify({ ok: false, reason: "missing_id" }),
          };
        }
        const invalid = ensureUuidId(call, todoId);
        if (invalid) return invalid;
        const patch: {
          text?: string;
          due_at?: string | null;
          due_text?: string | null;
        } = {};
        if (typeof args.text === "string") patch.text = args.text;
        if (args.due_at === null) patch.due_at = null;
        else if (typeof args.due_at === "string") {
          patch.due_at = normalizeIso(args.due_at);
        }
        if (args.due_text === null) patch.due_text = null;
        else if (typeof args.due_text === "string") {
          patch.due_text = args.due_text.trim().slice(0, 200) || null;
        }
        const result = await updateMemory(lineUserId, todoId, patch);
        return { tool_call_id: call.id, content: JSON.stringify(result) };
      }
      default:
        return {
          tool_call_id: call.id,
          content: JSON.stringify({
            ok: false,
            reason: "unknown_tool",
            tool: call.function.name,
          }),
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      tool_call_id: call.id,
      content: JSON.stringify({ ok: false, reason: "tool_error", error: message }),
    };
  }
}

// UUID v4 / v5 / etc. — supabase gen_random_uuid() is v4.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate that the model passed an actual UUID, not a 1-based list index
 * like "3" (Gemini sometimes confuses the numbered position the user sees
 * in our reply with the underlying database id). Returns a structured tool
 * error the model can understand and recover from in the next loop iter.
 */
function ensureUuidId(call: ToolCall, todoId: string): ToolResult | null {
  if (UUID_RE.test(todoId)) return null;
  return {
    tool_call_id: call.id,
    content: JSON.stringify({
      ok: false,
      reason: "invalid_id",
      message: `todo_id must be a UUID (like "550e8400-e29b-41d4-a716-446655440000"), got "${todoId.slice(0, 60)}". The number in a numbered reply is a position, NOT the id. Call list_pending again, look at each item's "id" field, and pass that exact UUID.`,
    }),
  };
}

function parseArgs(raw: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function normalizeIso(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
