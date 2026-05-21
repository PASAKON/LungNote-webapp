import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFreshAccessToken, startWatch, type ConnectionTokenSnapshot } from "./client";

/**
 * Gmail users.watch() helpers — ADR-0017 §"Sync Trigger".
 *
 * - startGmailWatchForUser(userId) — called from connect callback + watch-renew cron.
 * - renewExpiringWatches() — cron daily: re-watch any connection that expires
 *   within RENEW_BEFORE_MS.
 *
 * watch() returns historyId + expiration (max 7d ahead). We store
 * watch_expires_at + last_history_id so subsequent history.list cursors are
 * grounded.
 */

const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000; // 24h

export type WatchRenewSummary = {
  considered: number;
  renewed: number;
  failed: number;
};

function topicName(): string {
  const t = process.env.GMAIL_PUBSUB_TOPIC;
  if (!t) throw new Error("GMAIL_PUBSUB_TOPIC missing");
  return t;
}

function toBuf(v: unknown): Buffer {
  if (Buffer.isBuffer(v)) return v;
  if (typeof v === "string") {
    if (v.startsWith("\\x")) return Buffer.from(v.slice(2), "hex");
    return Buffer.from(v, "base64");
  }
  return Buffer.from(v as ArrayBufferLike);
}

export async function startGmailWatchForUser(userId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const sb = createAdminClient();
  const { data: row } = await sb
    .from("lungnote_gmail_connections")
    .select(
      "id, refresh_token_enc, access_token_enc, access_token_expires_at",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!row) return { ok: false, error: "no_connection" };

  const snapshot: ConnectionTokenSnapshot = {
    id: row.id,
    refresh_token_enc: toBuf(row.refresh_token_enc),
    access_token_enc: row.access_token_enc ? toBuf(row.access_token_enc) : null,
    access_token_expires_at: row.access_token_expires_at,
  };

  try {
    const fresh = await getFreshAccessToken(snapshot);
    const watch = await startWatch(fresh.accessToken, topicName());

    await sb
      .from("lungnote_gmail_connections")
      .update({
        last_history_id: watch.historyId,
        watch_expires_at: new Date(Number(watch.expiration) || 0).toISOString(),
        watch_resource_state: "active",
        last_error: null,
        ...(fresh.rotated && fresh.newAccessTokenEnc
          ? {
              access_token_enc: fresh.newAccessTokenEnc,
              access_token_expires_at: fresh.expiresAt.toISOString(),
            }
          : {}),
      })
      .eq("id", row.id);

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await sb
      .from("lungnote_gmail_connections")
      .update({
        watch_resource_state: "error",
        last_error: `watch_failed: ${msg.slice(0, 200)}`,
      })
      .eq("id", row.id);
    return { ok: false, error: msg };
  }
}

/** Renew any connection whose watch_expires_at falls within 24h. */
export async function renewExpiringWatches(): Promise<WatchRenewSummary> {
  const sb = createAdminClient();
  const deadlineIso = new Date(Date.now() + RENEW_BEFORE_MS).toISOString();

  const { data: candidates } = await sb
    .from("lungnote_gmail_connections")
    .select("user_id")
    .eq("status", "active")
    .or(`watch_expires_at.is.null,watch_expires_at.lt.${deadlineIso}`);

  const list = candidates ?? [];
  let renewed = 0;
  let failed = 0;
  for (const c of list) {
    const r = await startGmailWatchForUser(c.user_id);
    if (r.ok) renewed += 1;
    else failed += 1;
  }
  return { considered: list.length, renewed, failed };
}
