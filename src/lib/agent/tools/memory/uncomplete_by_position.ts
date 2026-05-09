import "server-only";
import { z } from "zod";
import { uncompleteMemory } from "@/lib/memory/mutate";
import type { AgentTool } from "../../tool";

const args = z.object({
  position: z
    .number()
    .int()
    .min(1)
    .describe("1-based position from the most recent list_done."),
});

export const uncompleteByPositionTool: AgentTool<z.infer<typeof args>> = {
  name: "uncomplete_by_position",
  category: "memory",
  description:
    "Re-open a completed todo by its position (1-based) from the most recent list_done. Use when user says 'undo' / 'ติ๊กผิด'.",
  schema: args,
  requires: ["linked", "done_listed"],
  async execute(input, ctx) {
    if (!ctx.lineUserId) return { ok: false, reason: "not_linked" };
    const item = ctx.getDoneByPosition(input.position);
    if (!item) {
      return {
        ok: false,
        reason: "out_of_range",
        message: `position ${input.position} not in done list. Call list_done first.`,
      };
    }
    const result = await uncompleteMemory(ctx.lineUserId, item.id);
    if (!result.ok) {
      return { ok: false, reason: result.reason, error: result.error };
    }
    return { ok: true, text: result.text };
  },
};
