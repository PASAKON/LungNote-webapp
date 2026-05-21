import "server-only";
import { refreshAccessToken } from "./oauth";
import { decryptToken, encryptToken } from "./crypto";

/**
 * Thin Gmail REST wrapper — ADR-0017 §"Sync Trigger".
 *
 * Token lifecycle: rows in lungnote_gmail_connections store an encrypted
 * refresh_token (and optionally a cached access_token + expiry). Callers
 * pass the row; we hand back fresh access_token, refreshing if needed.
 */

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";
const TOKEN_REFRESH_SKEW_MS = 60_000; // refresh if <1m left

export type ConnectionTokenSnapshot = {
  id: string; // row id
  refresh_token_enc: string; // base64 ciphertext (text column)
  access_token_enc: string | null;
  access_token_expires_at: string | null;
};

export type FreshAccessToken = {
  accessToken: string;
  expiresAt: Date;
  rotated: boolean; // true → caller should persist new cipher + expiry
  newAccessTokenEnc?: string;
};

function aadFor(rowId: string): string {
  return `lungnote_gmail_connections:${rowId}`;
}

export async function getFreshAccessToken(
  conn: ConnectionTokenSnapshot,
): Promise<FreshAccessToken> {
  const aad = aadFor(conn.id);
  const refreshToken = decryptToken(conn.refresh_token_enc, aad);

  // Use cached access_token if it's still good for >= TOKEN_REFRESH_SKEW_MS.
  if (conn.access_token_enc && conn.access_token_expires_at) {
    const expMs = Date.parse(conn.access_token_expires_at);
    if (Number.isFinite(expMs) && expMs - Date.now() > TOKEN_REFRESH_SKEW_MS) {
      try {
        const at = decryptToken(conn.access_token_enc, aad);
        return {
          accessToken: at,
          expiresAt: new Date(expMs),
          rotated: false,
        };
      } catch {
        // fall through to refresh
      }
    }
  }

  const refreshed = await refreshAccessToken(refreshToken);
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  return {
    accessToken: refreshed.access_token,
    expiresAt,
    rotated: true,
    newAccessTokenEnc: encryptToken(refreshed.access_token, aad),
  };
}

async function gmailFetch<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${GMAIL_API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`gmail ${path} failed ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// =============================================================
// Gmail REST shapes (subset we use).
// =============================================================

export type GmailMessageRef = {
  id: string;
  threadId: string;
};

export type GmailHeader = { name: string; value: string };

export type GmailMessageMetadata = {
  id: string;
  threadId: string;
  internalDate: string; // ms epoch string
  snippet: string;
  payload: { headers: GmailHeader[] };
  labelIds?: string[];
};

export type GmailHistoryResponse = {
  history?: Array<{
    id: string;
    messagesAdded?: Array<{ message: GmailMessageRef & { labelIds?: string[] } }>;
  }>;
  nextPageToken?: string;
  historyId: string;
};

export type GmailMessagesListResponse = {
  messages?: GmailMessageRef[];
  nextPageToken?: string;
  resultSizeEstimate: number;
};

export type GmailWatchResponse = {
  historyId: string;
  expiration: string; // ms epoch string (max 7d ahead)
};

// =============================================================
// API calls
// =============================================================

export function listInboxMessages(
  accessToken: string,
  opts: { maxResults?: number; q?: string; pageToken?: string } = {},
): Promise<GmailMessagesListResponse> {
  const params = new URLSearchParams();
  params.set("labelIds", "INBOX");
  if (opts.maxResults) params.set("maxResults", String(opts.maxResults));
  if (opts.q) params.set("q", opts.q);
  if (opts.pageToken) params.set("pageToken", opts.pageToken);
  return gmailFetch(`/users/me/messages?${params.toString()}`, accessToken);
}

export function listHistorySince(
  accessToken: string,
  startHistoryId: string,
  pageToken?: string,
): Promise<GmailHistoryResponse> {
  const params = new URLSearchParams({
    startHistoryId,
    historyTypes: "messageAdded",
    labelId: "INBOX",
  });
  if (pageToken) params.set("pageToken", pageToken);
  return gmailFetch(`/users/me/history?${params.toString()}`, accessToken);
}

export function getMessageMetadata(
  accessToken: string,
  messageId: string,
): Promise<GmailMessageMetadata> {
  const params = new URLSearchParams({ format: "metadata" });
  ["From", "Subject", "Date", "Message-ID"].forEach((h) =>
    params.append("metadataHeaders", h),
  );
  return gmailFetch(
    `/users/me/messages/${encodeURIComponent(messageId)}?${params.toString()}`,
    accessToken,
  );
}

export function startWatch(
  accessToken: string,
  topicName: string,
): Promise<GmailWatchResponse> {
  return gmailFetch(`/users/me/watch`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      topicName,
      labelIds: ["INBOX"],
      labelFilterBehavior: "INCLUDE",
    }),
  });
}

export function stopWatch(accessToken: string): Promise<unknown> {
  return gmailFetch(`/users/me/stop`, accessToken, { method: "POST" });
}

// =============================================================
// Header helpers
// =============================================================

export function findHeader(
  headers: GmailHeader[],
  name: string,
): string | null {
  const lower = name.toLowerCase();
  for (const h of headers) {
    if (h.name.toLowerCase() === lower) return h.value;
  }
  return null;
}

/** Truncate "Name <local@domain>" → "Name <domain>" — drop local part for privacy. */
export function truncateFromHeader(from: string): string {
  if (!from) return "";
  const match = /<([^>]+)>/.exec(from);
  if (!match) return from.slice(0, 80);
  const addr = match[1];
  const at = addr.lastIndexOf("@");
  const domain = at >= 0 ? addr.slice(at + 1) : addr;
  const name = from.slice(0, match.index).trim().replace(/[",]/g, "").slice(0, 60);
  return name ? `${name} <${domain}>` : `<${domain}>`;
}

export function permalinkFor(threadId: string): string {
  return `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
}
