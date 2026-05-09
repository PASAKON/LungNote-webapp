import "server-only";
import { listPendingFromLine, listDoneFromLine } from "@/lib/memory/list";
import type { TurnContext } from "./context";

/**
 * Auto-fetch the pending list into TurnContext if not cached this turn.
 * Used by *_by_position tools so the agent can do a single-step
 * "delete 3" without the agent first calling list_pending explicitly.
 *
 * Returns null on success (cache populated), or a structured error result
 * to bubble back to the model.
 */
type AutoListError = { ok: false; reason: string; error?: string };

export async function ensurePendingList(
  ctx: TurnContext,
): Promise<null | AutoListError> {
  if (ctx.hasPendingList()) return null;
  if (!ctx.lineUserId) return { ok: false, reason: "not_linked" };

  // Coalesce parallel callers (e.g. multiple delete_by_position in one
  // response) onto a single list_pending fetch.
  if (!ctx.pendingListPromise) {
    ctx.pendingListPromise = listPendingFromLine(ctx.lineUserId).then((r) => {
      if (r.ok) {
        ctx.setPendingList(
          r.items.map((it) => ({
            id: it.id,
            text: it.text,
            due_at: it.due_at,
            due_text: it.due_text,
            created_at: it.created_at,
          })),
        );
        ctx.trace.step("auto_list_pending", { count: r.items.length });
      }
      return r;
    });
  }
  const r = (await ctx.pendingListPromise) as
    | { ok: true; items: unknown[] }
    | { ok: false; reason: string; error?: string };
  if (!r.ok) return { ok: false, reason: r.reason, error: r.error };
  return null;
}

export async function ensureDoneList(
  ctx: TurnContext,
): Promise<null | AutoListError> {
  if (ctx.hasDoneList()) return null;
  if (!ctx.lineUserId) return { ok: false, reason: "not_linked" };

  if (!ctx.doneListPromise) {
    ctx.doneListPromise = listDoneFromLine(ctx.lineUserId).then((r) => {
      if (r.ok) {
        ctx.setDoneList(
          r.items.map((it) => ({
            id: it.id,
            text: it.text,
            due_at: it.due_at,
            due_text: it.due_text,
            created_at: it.created_at,
          })),
        );
        ctx.trace.step("auto_list_done", { count: r.items.length });
      }
      return r;
    });
  }
  const r = (await ctx.doneListPromise) as
    | { ok: true; items: unknown[] }
    | { ok: false; reason: string; error?: string };
  if (!r.ok) return { ok: false, reason: r.reason, error: r.error };
  return null;
}
