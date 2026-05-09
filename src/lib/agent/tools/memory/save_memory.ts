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
