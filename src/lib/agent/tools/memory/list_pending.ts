import "server-only";
import { z } from "zod";
import { listPendingFromLine } from "@/lib/memory/list";
import type { AgentTool } from "../../tool";

const args = z.object({}).strict();

export const listPendingTool: AgentTool<z.infer<typeof args>> = {
  name: "list_pending",
  category: "memory",
  description:
    "Read user's open todos. Returns up to 20 items with position+text+due_at. Server caches the list — afterwards prefer *_by_position tools to mutate.",
  schema: args,
  requires: ["linked"],
  async execute(_input, ctx) {
    if (!ctx.lineUserId) return { ok: false, reason: "not_linked" };
    const result = await listPendingFromLine(ctx.lineUserId);
    if (!result.ok) {
      return { ok: false, reason: result.reason, error: result.error };
    }
    // Update working memory so subsequent *_by_position calls can resolve.
    ctx.setPendingList(
      result.items.map((it) => ({
        id: it.id,
        text: it.text,
        due_at: it.due_at,
        due_text: it.due_text,
        created_at: it.created_at,
      })),
    );
    // Return position-numbered items for the model. Hide UUIDs to prevent
    // the model from passing them as args (it should use position tools).
    return {
      ok: true,
      count: result.items.length,
      items: result.items.map((it, i) => ({
        position: i + 1,
        text: it.text,
        due_at: it.due_at,
        due_text: it.due_text,
      })),
    };
  },
};
