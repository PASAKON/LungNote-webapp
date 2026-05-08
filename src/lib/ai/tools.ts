import "server-only";
import { saveMemoryRaw } from "@/lib/memory/save";
import { listPendingFromLine, listDoneFromLine } from "@/lib/memory/list";
import {
  completeMemory,
  deleteMemory,
  uncompleteMemory,
  updateMemory,
} from "@/lib/memory/mutate";

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
      name: "list_done",
      description:
        "List the user's recently completed (done) todos. Call this only when you need to find the id of a done item — e.g. user says 'undo เมื่อกี้', 'เอา ประชุม กลับมา', 'ผมยังไม่เสร็จ ทดสอบ'. Returns up to 20 items, most-recently completed first. For normal 'what's left' questions use list_pending.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "uncomplete_memory",
      description:
        "Re-open a previously completed todo (set done=false). Call this when the user wants to undo a completion — e.g. 'undo', 'ติ๊กผิดแล้ว', 'X ยังไม่เสร็จ'. You MUST first call list_done to learn the id; never invent one. If the user's reference is ambiguous, ask them to clarify.",
      parameters: {
        type: "object",
        properties: {
          todo_id: {
            type: "string",
            description: "UUID returned by list_done for the matching item.",
          },
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
        "Edit an existing todo's text and/or due date. Call this when the user wants to reschedule, rename, or remove a date — e.g. 'เลื่อน ประชุม เป็นวันศุกร์', 'เปลี่ยน เวลานัดหมอ เป็น 5 โมง', 'แก้ X เป็น Y', 'เอาวันที่ออก'. You MUST first call list_pending (or list_done) to learn the id; never invent one. Pass only the fields you're changing — omitted fields are untouched. To clear an existing date, pass due_at as null and due_text as null. Resolve relative date phrases against today (Asia/Bangkok) the same way save_memory does.",
      parameters: {
        type: "object",
        properties: {
          todo_id: {
            type: "string",
            description: "UUID returned by list_pending or list_done.",
          },
          text: {
            type: "string",
            description:
              "New cleaned action text. Omit to keep the current text.",
          },
          due_at: {
            type: ["string", "null"],
            description:
              "New ISO 8601 timestamp with +07:00 offset, or null to clear the date. Omit to keep the current date.",
          },
          due_text: {
            type: ["string", "null"],
            description:
              "New raw user phrase that conveyed the time, or null to clear it. Omit to keep current.",
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
        const result = await uncompleteMemory(lineUserId, todoId);
        return { tool_call_id: call.id, content: JSON.stringify(result) };
      }
      case "update_memory": {
        const todoId = typeof args.todo_id === "string" ? args.todo_id : "";
        if (!todoId) {
          return {
            tool_call_id: call.id,
            content: JSON.stringify({ ok: false, reason: "missing_id" }),
          };
        }
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
