import "server-only";
import { z } from "zod";
import { uncompleteMemory } from "@/lib/memory/mutate";
import { ensureDoneList } from "../../auto_list";
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
    "Re-open a completed todo by 1-based position. Use when user says 'undo' / 'ติ๊กผิด'. Server auto-fetches list_done if not called this turn.",
  schema: args,
  requires: ["linked"],
  async execute(input, ctx) {
    if (!ctx.lineUserId) return { ok: false, reason: "not_linked" };
    const listErr = await ensureDoneList(ctx);
    if (listErr) return listErr;
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
