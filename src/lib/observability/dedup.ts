import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Idempotency check — has this LINE event already been processed
 * successfully? Reads from lungnote_chat_traces (where reply_text is
 * non-null AND error_text is null = we did reply).
 *
 * Why: LINE may redeliver the same webhook event (network retry,
 * timeout, edge restart). Without this check the bot replies twice and
 * saves duplicate todos. The trace row is our source of truth — it
 * lands at the end of every turn that produced a reply.
 *
 * Caveat: trace insert is fire-and-forget, so if turn N's trace fails
 * to land, a redelivery of N would re-process. Acceptable trade-off vs
 * over-engineering — duplicate replies are annoying, but missing a
 * reply when our DB is down is worse.
 *
 * TTL: only checks traces from the last 5 min (LINE redelivery window).
 * Older traces don't dedup so a user can repeat the same message text
 * intentionally.
 */
const REDELIVERY_WINDOW_MS = 5 * 60 * 1000;

export type DedupResult =
  | { status: "fresh" }
  | { status: "already_processed"; replyText: string | null };

export async function checkAlreadyProcessed(
  messageId: string,
): Promise<DedupResult> {
  if (!messageId) return { status: "fresh" };
  try {
    const sb = createAdminClient();
    const since = new Date(Date.now() - REDELIVERY_WINDOW_MS).toISOString();
    const { data, error } = await sb
      .from("lungnote_chat_traces")
      .select("reply_text, error_text, created_at")
      .eq("trace_id", messageId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return { status: "fresh" };
    const row = data as {
      reply_text: string | null;
      error_text: string | null;
    };
    // A successful prior turn = reply_text non-null AND no error.
    if (row.reply_text && !row.error_text) {
      return { status: "already_processed", replyText: row.reply_text };
    }
    return { status: "fresh" };
  } catch (err) {
    console.error("checkAlreadyProcessed failed (assuming fresh)", err);
    return { status: "fresh" };
  }
}
