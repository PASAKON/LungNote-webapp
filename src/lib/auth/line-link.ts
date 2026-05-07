import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const TOKEN_TTL_SECONDS = 5 * 60;
const MAX_ACTIVE_TOKENS_PER_USER = 3;

export type MintedToken = {
  token: string;
  expiresAt: Date;
};

export async function mintToken(lineUserId: string): Promise<MintedToken> {
  const admin = createAdminClient();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000);

  // Clean expired + over-quota tokens for this user
  await admin
    .from("lungnote_auth_link_tokens")
    .delete()
    .eq("line_user_id", lineUserId)
    .or(`expires_at.lt.${new Date().toISOString()},used_at.not.is.null`);

  // Enforce per-user active limit (FIFO trim)
  const { data: active } = await admin
    .from("lungnote_auth_link_tokens")
    .select("id")
    .eq("line_user_id", lineUserId)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  if (active && active.length >= MAX_ACTIVE_TOKENS_PER_USER) {
    const trimCount = active.length - MAX_ACTIVE_TOKENS_PER_USER + 1;
    const toTrim = active.slice(0, trimCount).map((r) => r.id);
    await admin
      .from("lungnote_auth_link_tokens")
      .delete()
      .in("id", toTrim);
  }

  const { error } = await admin.from("lungnote_auth_link_tokens").insert({
    line_user_id: lineUserId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });

  if (error) throw new Error(`mintToken insert failed: ${error.message}`);

  return { token, expiresAt };
}

export async function redeemToken(
  token: string,
): Promise<{ lineUserId: string } | null> {
  const admin = createAdminClient();
  const tokenHash = sha256(token);
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("lungnote_auth_link_tokens")
    .select("id, line_user_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .gt("expires_at", now)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const { error: updateError } = await admin
    .from("lungnote_auth_link_tokens")
    .update({ used_at: now })
    .eq("id", data.id)
    .is("used_at", null);

  if (updateError) return null;

  return { lineUserId: data.line_user_id };
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
