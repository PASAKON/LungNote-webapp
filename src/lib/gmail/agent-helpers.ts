import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getFreshAccessToken,
  type ConnectionTokenSnapshot,
} from "./client";

/**
 * Agent-side helpers — ADR-0020. Bridge LINE userId → Supabase user_id →
 * Gmail connection so each agent tool stays thin.
 *
 * Why this layer: TurnContext only carries `lineUserId`. Profile and
 * connection lookups would otherwise be duplicated in every Gmail tool.
 * Single helper, single shape returned, one place to optimize / mock.
 */

const PUBLIC_SCHEMA_PROFILES = "lungnote_profiles" as const;
const PUBLIC_SCHEMA_CONNECTIONS = "lungnote_gmail_connections" as const;

export type ResolvedGmailConnection = {
  userId: string;
  email: string;
  scope: string;
  status: string;
  snapshot: ConnectionTokenSnapshot;
  lastHistoryId: string | null;
};

/** Returns the auth.users.id (uuid) for a given LINE userId, or null. */
export async function resolveSupabaseUserIdFromLine(
  lineUserId: string,
): Promise<string | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from(PUBLIC_SCHEMA_PROFILES)
    .select("id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  return data?.id ?? null;
}

/** Cheap precondition probe used by registry.ts checkRequirements. */
export async function hasActiveGmailConnection(
  lineUserId: string,
): Promise<boolean> {
  const userId = await resolveSupabaseUserIdFromLine(lineUserId);
  if (!userId) return false;
  const sb = createAdminClient();
  const { data } = await sb
    .from(PUBLIC_SCHEMA_CONNECTIONS)
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return data?.id != null;
}

/**
 * Load the active Gmail connection plus a token snapshot ready for
 * getFreshAccessToken(). Returns null when missing — caller handles the
 * error path. Bytea columns are normalized into Buffer once here.
 */
export async function loadActiveGmailConnection(
  lineUserId: string,
): Promise<ResolvedGmailConnection | null> {
  const userId = await resolveSupabaseUserIdFromLine(lineUserId);
  if (!userId) return null;
  const sb = createAdminClient();
  const { data } = await sb
    .from(PUBLIC_SCHEMA_CONNECTIONS)
    .select(
      "id, email, scope, status, refresh_token_enc, access_token_enc, access_token_expires_at, last_history_id",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;

  return {
    userId,
    email: data.email,
    scope: data.scope,
    status: data.status,
    snapshot: {
      id: data.id,
      refresh_token_enc: data.refresh_token_enc,
      access_token_enc: data.access_token_enc ?? null,
      access_token_expires_at: data.access_token_expires_at,
    },
    lastHistoryId: data.last_history_id,
  };
}

/**
 * Get a Gmail access token + persist any rotated cipher back to the
 * connection row. Tools should call this once at the top, then make
 * REST calls with the returned token.
 */
export async function withFreshAccessToken(
  conn: ResolvedGmailConnection,
): Promise<{ accessToken: string }> {
  const fresh = await getFreshAccessToken(conn.snapshot);
  if (fresh.rotated && fresh.newAccessTokenEnc) {
    const sb = createAdminClient();
    await sb
      .from(PUBLIC_SCHEMA_CONNECTIONS)
      .update({
        access_token_enc: fresh.newAccessTokenEnc,
        access_token_expires_at: fresh.expiresAt.toISOString(),
      })
      .eq("id", conn.snapshot.id);
  }
  return { accessToken: fresh.accessToken };
}

/** Returns true if the connection's scope grants gmail.modify or full. */
export function hasModifyScope(conn: ResolvedGmailConnection): boolean {
  const s = conn.scope;
  return (
    s.includes("gmail.modify") || s.includes("https://mail.google.com/")
  );
}

/**
 * Returns true if the connection can SEND a message — gmail.send, gmail.modify,
 * or full all grant sending. Reply tooling gates on this (ADR-0021).
 */
export function canSendReply(conn: ResolvedGmailConnection): boolean {
  const s = conn.scope;
  return (
    s.includes("gmail.send") ||
    s.includes("gmail.modify") ||
    s.includes("https://mail.google.com/")
  );
}

