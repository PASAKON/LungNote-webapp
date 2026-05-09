import "server-only";
import { z } from "zod";
import { completeMemory } from "@/lib/memory/mutate";
import type { AgentTool } from "../../tool";

const args = z.object({
  position: z
    .number()
    .int()
    .min(1)
    .describe("1-based position from list_pending output."),
});

export const completeByPositionTool: AgentTool<z.infer<typeof args>> = {
  name: "complete_by_position",
  category: "memory",
  description:
    "Mark a pending todo done by its position (1-based) from the most recent list_pending. Preferred over complete_memory — never confuses position with UUID.",
  schema: args,
  requires: ["linked", "pending_listed"],
  async execute(input, ctx) {
    if (!ctx.lineUserId) return { ok: false, reason: "not_linked" };
    const item = ctx.getPendingByPosition(input.position);
    if (!item) {
      return {
        ok: false,
        reason: "out_of_range",
        message: `position ${input.position} not in pending list (size=${ctx.pendingCount()}). Re-list or pick a valid position.`,
      };
    }
    const result = await completeMemory(ctx.lineUserId, item.id);
    if (!result.ok) {
      return { ok: false, reason: result.reason, error: result.error };
    }
    return { ok: true, text: result.text, todoId: result.todoId };
  },
};
