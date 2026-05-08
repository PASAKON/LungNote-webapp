import "server-only";
import { saveMemoryRaw } from "@/lib/memory/save";
import { listPendingFromLine } from "@/lib/memory/list";
import { completeMemory, deleteMemory } from "@/lib/memory/mutate";

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
        "Save a reminder/todo for the user. Call this when the user wants to remember, schedule, or jot down a task — e.g. 'พรุ่งนี้ส่งการบ้าน', 'อย่าลืมโทรหาแม่', 'todo ซื้อนม'. The text should be the cleaned action (no leading 'จด ' or 'todo ' prefix). If the user mentioned a date/time, resolve it relative to today's Asia/Bangkok date (provided in the system prompt) and pass it as ISO 8601 with +07:00 offset.",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description:
              "The action/reminder content, cleaned of prefixes and date phrases. Preserve the user's language (Thai stays Thai).",
          },
          due_at: {
            type: "string",
            description:
              "Optional ISO 8601 timestamp with +07:00 offset (e.g. '2026-05-09T09:00:00+07:00'). Default time = 09:00 if user gave a date but no time. Omit if no temporal phrase.",
          },
          due_text: {
            type: "string",
            description:
              "The exact phrase the user wrote that conveyed the time (e.g. 'พรุ่งนี้', 'วันพุธหน้า 3 โมง'). Omit if due_at is omitted.",
          },
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
        "List the user's pending (not-done) todos/reminders. Call this when the user asks what they have to do, what's left, what's due soon, or what's overdue — e.g. 'งานค้าง', 'ตอนนี้มีงานอะไรบ้าง', 'ดูโน้ต', 'todo อะไรบ้าง'. Returns up to 20 items with their `id`, `text`, and `due_at`. Use the returned `id` field for subsequent complete_memory or delete_memory calls.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "complete_memory",
      description:
        "Mark a todo as done. Call this when the user says they finished a task — e.g. 'ทดสอบเสร็จแล้ว', 'done', 'เสร็จละ', 'ส่งการบ้านแล้ว'. You MUST call list_pending first to get the item id; never invent an id. If the user's reference is ambiguous (more than one item matches), ask them to clarify before calling this tool.",
      parameters: {
        type: "object",
        properties: {
          todo_id: {
            type: "string",
            description: "UUID returned by list_pending for the matching item.",
          },
        },
        required: ["todo_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_memory",
      description:
        "Permanently delete a todo. Call this when the user wants to remove an item — e.g. 'เอาทดสอบออก', 'ลบงาน X', 'remove the meeting'. You MUST call list_pending first to get the item id; never invent an id. If the user's reference is ambiguous, ask them to clarify before calling this tool. Deletion is irreversible — be conservative and confirm in your reply that the named item was removed.",
      parameters: {
        type: "object",
        properties: {
          todo_id: {
            type: "string",
            description: "UUID returned by list_pending for the matching item.",
          },
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
        const result = await deleteMemory(lineUserId, todoId);
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
