import "server-only";
import { z } from "zod";
import { deleteMemory } from "@/lib/memory/mutate";
import { ensurePendingList } from "../../auto_list";
import type { AgentTool } from "../../tool";

const args = z.object({
  position: z.number().int().min(1).describe("1-based position from list_pending."),
});

export const deleteByPositionTool: AgentTool<z.infer<typeof args>> = {
  name: "delete_by_position",
  category: "memory",
  description:
    "Permanently delete a pending todo by 1-based position. Irreversible. Server auto-fetches list_pending if not called this turn.",
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
    const result = await deleteMemory(ctx.lineUserId, item.id);
    if (!result.ok) {
      return { ok: false, reason: result.reason, error: result.error };
    }
    // remaining_count = pending list size BEFORE this delete, minus 1.
    // AI uses this for the todo_deleted flex card.
    const remaining_count = Math.max(0, ctx.pendingCount() - 1);
    return { ok: true, text: result.text, remaining_count };
  },
};
