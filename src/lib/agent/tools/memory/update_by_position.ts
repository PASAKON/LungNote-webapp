import "server-only";
import { z } from "zod";
import { updateMemory } from "@/lib/memory/mutate";
import { ensurePendingList } from "../../auto_list";
import type { AgentTool } from "../../tool";

const args = z.object({
  position: z.number().int().min(1).describe("1-based position from list_pending."),
  text: z.string().nullish().describe("New text. Omit to keep."),
  due_at: z
    .string()
    .nullish()
    .describe("New ISO 8601 +07:00, or null to clear date."),
  due_text: z.string().nullish().describe("New raw phrase, or null to clear."),
});

export const updateByPositionTool: AgentTool<z.infer<typeof args>> = {
  name: "update_by_position",
  category: "memory",
  description:
    "Edit a pending todo by 1-based position. Pass only changed fields. Clear date = both due_at + due_text null. Server auto-fetches list_pending if needed.",
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
        message: `position ${input.position} not in pending list (size=${ctx.pendingCount()}).`,
      };
    }
    const patch: { text?: string; due_at?: string | null; due_text?: string | null } = {};
    if (typeof input.text === "string") patch.text = input.text;
    if (input.due_at === null) patch.due_at = null;
    else if (typeof input.due_at === "string") patch.due_at = input.due_at;
    if (input.due_text === null) patch.due_text = null;
    else if (typeof input.due_text === "string") patch.due_text = input.due_text;

    if (Object.keys(patch).length === 0) {
      return { ok: false, reason: "no_change", message: "No fields to update." };
    }
    const result = await updateMemory(ctx.lineUserId, item.id, patch);
    if (!result.ok) {
      return { ok: false, reason: result.reason, error: result.error };
    }
    return { ok: true, text: result.text };
  },
};
