import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  type EmailInput,
  classifyEmailsForTodo,
} from "@/lib/ai/email-classify";
import {
  findHeader,
  getFreshAccessToken,
  getMessageMetadata,
  listHistorySince,
  listInboxMessages,
  permalinkFor,
  truncateFromHeader,
  type ConnectionTokenSnapshot,
} from "./client";

/**
 * Gmail sync engine — ADR-0017 §"Sync Trigger".
 *
 * Idempotent: dedup via lungnote_gmail_synced_messages.unique(user_id,
 * message_id). Used by both the Pub/Sub webhook (Task #11) and the
 * reconcile cron (Task #13).
 *
 * Steps for one connection:
 *   1. Get fresh access_token (refresh + persist cipher if rotated)
 *   2. Collect new message ids:
 *      - first run (no last_history_id) → listInboxMessages 24h cap 50
 *      - subsequent → listHistorySince(last_history_id)
 *   3. Filter out message ids already in synced_messages
 *   4. Fetch metadata for each new message (concurrency-limited)
 *   5. Classify in batches of 10 via Gemini Flash
 *   6. For each (is_urgent_todo || needs_reply): ensure Inbox note, insert
 *      lungnote_todos (source='email'), then insert synced_messages
 *   7. For non-todo: insert synced_messages (is_todo=false) so future
 *      reconcile skips it
 *   8. Update connection.last_history_id + last_synced_at; clear last_error
 *
 * Failures bubble up to caller which records last_error/status on the
 * connection row.
 */

const INBOX_TITLE = "📥 Inbox";
const FIRST_RUN_MAX = 50;
const FETCH_METADATA_CONCURRENCY = 5;
const CLASSIFY_BATCH = 10;

export type SyncResult = {
  connectionId: string;
  userId: string;
  scanned: number;
  todosCreated: number;
  skipped: number;
  error: string | null;
};

type ConnectionRow = ConnectionTokenSnapshot & {
  user_id: string;
  email: string;
  last_history_id: string | null;
};

/** Sync all active connections. Used by reconcile cron (Task #13). */
export async function syncAllActiveConnections(): Promise<SyncResult[]> {
  const sb = createAdminClient();
  const { data: conns, error } = await sb
    .from("lungnote_gmail_connections")
    .select(
      "id, user_id, email, refresh_token_enc, access_token_enc, access_token_expires_at, last_history_id",
    )
    .eq("status", "active");
  if (error || !conns) return [];

  // Bounded concurrency across users to spare quotas + cold starts.
  const results: SyncResult[] = [];
  const queue = [...conns];
  const workers = Math.min(5, queue.length);
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (queue.length) {
        const conn = queue.shift();
        if (!conn) break;
        results.push(await syncOneConnection(normalize(conn)));
      }
    }),
  );
  return results;
}

/** Sync exactly one user (used by webhook handler — single email arrival). */
export async function syncForUser(userId: string): Promise<SyncResult | null> {
  const sb = createAdminClient();
  const { data: conn } = await sb
    .from("lungnote_gmail_connections")
    .select(
      "id, user_id, email, refresh_token_enc, access_token_enc, access_token_expires_at, last_history_id",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!conn) return null;
  return syncOneConnection(normalize(conn));
}

function normalize(row: Record<string, unknown>): ConnectionRow {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    email: row.email as string,
    refresh_token_enc: toBuf(row.refresh_token_enc),
    access_token_enc: row.access_token_enc ? toBuf(row.access_token_enc) : null,
    access_token_expires_at: (row.access_token_expires_at as string) ?? null,
    last_history_id: (row.last_history_id as string) ?? null,
  };
}

function toBuf(v: unknown): Buffer {
  if (Buffer.isBuffer(v)) return v;
  if (typeof v === "string") {
    // Supabase PostgREST returns bytea as `\x<hex>` or base64 — try both.
    if (v.startsWith("\\x")) return Buffer.from(v.slice(2), "hex");
    return Buffer.from(v, "base64");
  }
  return Buffer.from(v as ArrayBufferLike);
}

async function syncOneConnection(conn: ConnectionRow): Promise<SyncResult> {
  const sb = createAdminClient();
  const result: SyncResult = {
    connectionId: conn.id,
    userId: conn.user_id,
    scanned: 0,
    todosCreated: 0,
    skipped: 0,
    error: null,
  };

  // 1. Token
  let accessToken: string;
  try {
    const fresh = await getFreshAccessToken(conn);
    accessToken = fresh.accessToken;
    if (fresh.rotated && fresh.newAccessTokenEnc) {
      await sb
        .from("lungnote_gmail_connections")
        .update({
          access_token_enc: fresh.newAccessTokenEnc,
          access_token_expires_at: fresh.expiresAt.toISOString(),
        })
        .eq("id", conn.id);
    }
  } catch (err) {
    return finishWithError(conn, result, "token_refresh_failed", err);
  }

  // 2. Collect candidate message ids + latest historyId for cursor advance.
  let messageIds: string[] = [];
  let newestHistoryId: string | null = null;
  try {
    if (conn.last_history_id) {
      const collected = await collectFromHistory(
        accessToken,
        conn.last_history_id,
      );
      messageIds = collected.ids;
      newestHistoryId = collected.newestHistoryId;
    } else {
      const listed = await listInboxMessages(accessToken, {
        maxResults: FIRST_RUN_MAX,
        q: "newer_than:1d",
      });
      messageIds = (listed.messages ?? []).map((m) => m.id);
      // historyId cursor unknown yet — established on next sync after metadata.
    }
  } catch (err) {
    return finishWithError(conn, result, "list_failed", err);
  }

  result.scanned = messageIds.length;

  if (messageIds.length === 0) {
    await sb
      .from("lungnote_gmail_connections")
      .update({
        last_synced_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", conn.id);
    return result;
  }

  // 3. Filter out already-seen message ids
  const { data: seen } = await sb
    .from("lungnote_gmail_synced_messages")
    .select("message_id")
    .eq("user_id", conn.user_id)
    .in("message_id", messageIds);
  const seenSet = new Set(
    ((seen ?? []) as Array<{ message_id: string }>).map((r) => r.message_id),
  );
  const fresh = messageIds.filter((id) => !seenSet.has(id));
  result.skipped = messageIds.length - fresh.length;

  if (fresh.length === 0) {
    await sb
      .from("lungnote_gmail_connections")
      .update({
        last_synced_at: new Date().toISOString(),
        last_history_id: newestHistoryId ?? conn.last_history_id,
        last_error: null,
      })
      .eq("id", conn.id);
    return result;
  }

  // 4. Fetch metadata with bounded concurrency
  const metaArr = await fetchAllMetadata(accessToken, fresh);

  // 5. Classify in batches of 10
  const classifyInputs: EmailInput[] = metaArr.map((m) => ({
    message_id: m.id,
    from: findHeader(m.payload.headers, "From") ?? "",
    subject: findHeader(m.payload.headers, "Subject") ?? "",
    snippet: m.snippet ?? "",
    internal_date: new Date(Number(m.internalDate) || 0).toISOString(),
  }));

  const classifications = await classifyEmailsForTodo(classifyInputs);
  const classifyById = new Map(classifications.map((c) => [c.message_id, c]));

  // 6 + 7. Ensure inbox once, then upsert per message
  let inboxId: string | null = null;
  for (const meta of metaArr) {
    const c = classifyById.get(meta.id);
    if (!c) continue;
    const fromRaw = findHeader(meta.payload.headers, "From") ?? "";
    const subjectRaw = findHeader(meta.payload.headers, "Subject") ?? "";
    const internalDateIso = new Date(Number(meta.internalDate) || 0).toISOString();
    const fromTrunc = truncateFromHeader(fromRaw);
    const subjectTrunc = subjectRaw.slice(0, 80);

    const isTodo = c.is_urgent_todo || c.needs_reply;

    let todoId: string | null = null;
    if (isTodo && c.text) {
      if (!inboxId) {
        inboxId = await ensureInboxNote(conn.user_id);
        if (!inboxId) {
          result.error = "inbox_create_failed";
          break;
        }
      }
      const { data: todo, error: todoErr } = await sb
        .from("lungnote_todos")
        .insert({
          user_id: conn.user_id,
          note_id: inboxId,
          text: c.text.slice(0, 2000),
          due_at: c.due_at,
          due_text: c.due_text,
          source: "email",
          source_external_id: meta.id,
          source_url: permalinkFor(meta.threadId),
        })
        .select("id")
        .single();
      if (todoErr) {
        // Most likely duplicate via unique index — treat as already-saved.
        if (todoErr.code !== "23505") {
          result.error = `todo_insert_failed:${todoErr.code ?? "?"}`;
          break;
        }
      } else if (todo?.id) {
        todoId = todo.id;
        result.todosCreated += 1;
      }
    }

    await sb.from("lungnote_gmail_synced_messages").upsert(
      {
        user_id: conn.user_id,
        connection_id: conn.id,
        message_id: meta.id,
        thread_id: meta.threadId,
        internal_date: internalDateIso,
        from_truncated: fromTrunc,
        subject_truncated: subjectTrunc,
        is_todo: isTodo,
        todo_id: todoId,
        ai_reason: c.reason.slice(0, 200),
      },
      { onConflict: "user_id,message_id" },
    );
  }

  // 8. Advance cursor + clear error
  await sb
    .from("lungnote_gmail_connections")
    .update({
      last_synced_at: new Date().toISOString(),
      last_history_id: newestHistoryId ?? conn.last_history_id,
      last_error: result.error,
      status: result.error ? "error" : "active",
    })
    .eq("id", conn.id);

  return result;
}

async function collectFromHistory(
  accessToken: string,
  startHistoryId: string,
): Promise<{ ids: string[]; newestHistoryId: string | null }> {
  const ids = new Set<string>();
  let pageToken: string | undefined;
  let newest: string | null = null;

  do {
    const page = await listHistorySince(accessToken, startHistoryId, pageToken);
    newest = page.historyId ?? newest;
    for (const h of page.history ?? []) {
      for (const m of h.messagesAdded ?? []) {
        ids.add(m.message.id);
      }
    }
    pageToken = page.nextPageToken;
  } while (pageToken);

  return { ids: Array.from(ids), newestHistoryId: newest };
}

async function fetchAllMetadata(
  accessToken: string,
  ids: string[],
): Promise<
  Array<{
    id: string;
    threadId: string;
    internalDate: string;
    snippet: string;
    payload: { headers: { name: string; value: string }[] };
  }>
> {
  const out: Awaited<ReturnType<typeof getMessageMetadata>>[] = [];
  const queue = [...ids];
  await Promise.all(
    Array.from({ length: Math.min(FETCH_METADATA_CONCURRENCY, queue.length) }, async () => {
      while (queue.length) {
        const id = queue.shift();
        if (!id) break;
        try {
          out.push(await getMessageMetadata(accessToken, id));
        } catch {
          // skip unfetchable message — caller may retry next reconcile
        }
      }
    }),
  );
  return out;
}

async function ensureInboxNote(userId: string): Promise<string | null> {
  const sb = createAdminClient();
  const { data: existing } = await sb
    .from("lungnote_notes")
    .select("id")
    .eq("user_id", userId)
    .eq("title", INBOX_TITLE)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created } = await sb
    .from("lungnote_notes")
    .insert({ user_id: userId, title: INBOX_TITLE, body: "" })
    .select("id")
    .single();
  return created?.id ?? null;
}

async function finishWithError(
  conn: ConnectionRow,
  result: SyncResult,
  code: string,
  err: unknown,
): Promise<SyncResult> {
  const sb = createAdminClient();
  const msg = err instanceof Error ? err.message : String(err);
  result.error = `${code}: ${msg.slice(0, 200)}`;
  await sb
    .from("lungnote_gmail_connections")
    .update({
      last_error: result.error,
      status: code === "token_refresh_failed" ? "expired" : "error",
    })
    .eq("id", conn.id);
  return result;
}

// Exported constant for callers that want to know the batch size.
export { CLASSIFY_BATCH };
