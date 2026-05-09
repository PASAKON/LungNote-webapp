import "server-only";
import { z } from "zod";
import { saveMemoryRaw } from "@/lib/memory/save";
import type { AgentTool } from "../../tool";

const args = z.object({
  text: z.string().describe("Cleaned action; preserve user's language."),
  due_at: z
    .string()
    .nullish()
    .describe("ISO 8601 +07:00; default 09:00 if no time."),
  due_text: z
    .string()
    .nullish()
    .describe("User's raw temporal phrase (e.g. 'พรุ่งนี้')."),
});

/**
 * Ambiguous strings that should never become a saved todo on their own.
 * These get blocked at the tool level (not just by prompt) because
 * conversation memory can poison the model — once it has seen "ทดสอบ →
 * บันทึก" once, it tends to repeat the pattern even after we add the
 * "ask for clarification" rule to the system prompt. Belt-and-suspenders.
 */
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

export const saveMemoryTool: AgentTool<z.infer<typeof args>> = {
  name: "save_memory",
  category: "memory",
  description: "Create a new todo/reminder. See system prompt §Decision Tree.",
  schema: args,
  requires: ["linked"],
  async execute(input, ctx) {
    if (!ctx.lineUserId) {
      return { ok: false, reason: "not_linked" };
    }
    if (isAmbiguousSaveText(input.text)) {
      return {
        ok: false,
        reason: "ambiguous_text",
        message:
          "Text is too short or generic to save as a todo (e.g. 'ทดสอบ', 'test', 'งาน'). Ask the user for more detail (a verb + object or a date) instead of saving. DON'T retry save_memory with the same text.",
      };
    }
    const result = await saveMemoryRaw({
      lineUserId: ctx.lineUserId,
      text: input.text,
      dueAt: input.due_at ?? null,
      dueText: input.due_text ?? null,
    });
    if (!result.ok) {
      return { ok: false, reason: result.reason, error: result.error };
    }
    return {
      ok: true,
      todoId: result.todoId,
      text: result.text,
      dueAt: result.dueAt,
      dueText: result.dueText,
    };
  },
};
