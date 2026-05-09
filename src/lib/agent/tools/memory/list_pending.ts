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
    // due_short + urgency_color are precomputed so the AI can pass them
    // straight into send_flex_reply({template:"todo_list"}) without
    // having to re-derive relative dates / colors itself.
    const now = new Date();
    return {
      ok: true,
      count: result.items.length,
      items: result.items.map((it, i) => {
        const { due_short, urgency_color } = formatDueChip(it.due_at, now);
        return {
          position: i + 1,
          text: it.text,
          due_at: it.due_at,
          due_text: it.due_text,
          due_short,
          urgency_color,
        };
      }),
    };
  },
};

/**
 * Cheap due-date renderer for the LINE flex chip. Returns "" + neutral
 * color when there's no due_at — the AI passes those straight through.
 */
function formatDueChip(
  iso: string | null,
  now: Date,
): { due_short: string; urgency_color: string } {
  if (!iso) return { due_short: "", urgency_color: "#a08050" };
  const due = new Date(iso);
  if (Number.isNaN(due.getTime()))
    return { due_short: "", urgency_color: "#a08050" };

  const dayMs = 1000 * 60 * 60 * 24;
  const dueDay = new Date(
    due.getFullYear(),
    due.getMonth(),
    due.getDate(),
  ).getTime();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const diff = Math.round((dueDay - today) / dayMs);

  if (diff < 0)
    return { due_short: `เลย ${Math.abs(diff)} วัน`, urgency_color: "#c45a3a" };
  if (diff === 0) return { due_short: "วันนี้", urgency_color: "#e8a946" };
  if (diff === 1) return { due_short: "พรุ่งนี้", urgency_color: "#e8a946" };
  if (diff <= 3)
    return { due_short: `อีก ${diff} วัน`, urgency_color: "#e8a946" };
  if (diff <= 7)
    return { due_short: `อีก ${diff} วัน`, urgency_color: "#3a3020" };
  return {
    due_short: due.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
    }),
    urgency_color: "#3a3020",
  };
}
