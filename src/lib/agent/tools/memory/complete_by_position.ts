import "server-only";
import { z } from "zod";
import { completeMemory } from "@/lib/memory/mutate";
import { ensurePendingList } from "../../auto_list";
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
    "Mark a pending todo done by 1-based position. If list_pending hasn't been called this turn, the server auto-fetches it before resolving the position.",
  schema: args,
  requires: ["linked"],
  async execute(input, ctx) {
    if (!ctx.lineUserId) return { ok: false, reason: "not_linked" };
    const listErr = await ensurePendingList(ctx);
    if (listErr) return listErr;
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
    // pending_count_left = how many pending items remain after marking
    // this one done. AI uses this for the todo_completed flex card.
    const pending_count_left = Math.max(0, ctx.pendingCount() - 1);
    return {
      ok: true,
      text: result.text,
      todoId: result.todoId,
      pending_count_left,
    };
  },
};
