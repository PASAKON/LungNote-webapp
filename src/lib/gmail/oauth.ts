import "server-only";
import { randomBytes, createHash } from "node:crypto";

/**
 * Google OAuth 2.0 helpers for Gmail connection — ADR-0017.
 *
 * Single scope `gmail.readonly` (Sensitive tier). LINE-only primary auth
 * is unchanged; Gmail is a secondary per-user connection.
 *
 * Flow:
 *   start: build state cookie → redirect to Google authorize
 *   callback: verify state → exchange code → return tokens + id payload
 *   revoke: POST to Google revoke endpoint (best-effort)
 */

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export type GmailScopeTier = "read" | "edit" | "full";

const GMAIL_SCOPE_BY_TIER: Record<GmailScopeTier, string> = {
  read: "https://www.googleapis.com/auth/gmail.readonly",
  edit: "https://www.googleapis.com/auth/gmail.modify",
  full: "https://mail.google.com/",
};

export const GMAIL_SCOPE = GMAIL_SCOPE_BY_TIER.read;

export function buildScopeString(tier: GmailScopeTier): string {
  return ["openid", "email", "profile", GMAIL_SCOPE_BY_TIER[tier]].join(" ");
}

export const FULL_SCOPES = buildScopeString("read");

export function isGmailScopeTier(v: unknown): v is GmailScopeTier {
  return v === "read" || v === "edit" || v === "full";
}

export const STATE_COOKIE = "gmail_oauth_state";
export const STATE_TTL_SECONDS = 5 * 60;

export type GmailTokenResponse = {
  access_token: string;
  refresh_token?: string; // returned only on first consent / prompt=consent
  expires_in: number;
  id_token?: string;
  scope: string;
  token_type: "Bearer";
};

export type GmailIdPayload = {
  sub: string; // google_user_id
  email: string;
  email_verified?: boolean;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}

export function newState(): string {
  return randomBytes(32).toString("base64url");
}

export function hashState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

export function buildAuthorizeUrl(opts: {
  state: string;
  redirectUri: string;
  tier?: GmailScopeTier;
}): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: buildScopeString(opts.tier ?? "read"),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent", // force refresh_token return every time
    state: opts.state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCode(opts: {
  code: string;
  redirectUri: string;
}): Promise<GmailTokenResponse> {
  const body = new URLSearchParams({
    code: opts.code,
    client_id: requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
    client_secret: requireEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
    redirect_uri: opts.redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`gmail token exchange failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as GmailTokenResponse;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<Pick<GmailTokenResponse, "access_token" | "expires_in" | "scope" | "token_type">> {
  const body = new URLSearchParams({
    client_id: requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
    client_secret: requireEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`gmail refresh failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as Awaited<ReturnType<typeof refreshAccessToken>>;
}

/**
 * Best-effort revoke. Google accepts either access_token or refresh_token.
 * Errors are logged but do not throw — caller still deletes local row.
 */
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    /* swallow */
  }
}

/**
 * Parse the id_token JWT payload (header.payload.signature → middle base64url).
 *
 * NOTE: NOT a signature verification. The id_token comes back over TLS from
 * Google's token endpoint, so transport authenticates it. If we ever consume
 * an id_token from an untrusted source (push subscription, etc.), use proper
 * JWKs verification via google-auth-library.
 */
export function parseIdTokenPayload(idToken: string): GmailIdPayload {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("malformed id_token");
  const payload = JSON.parse(
    Buffer.from(parts[1], "base64url").toString("utf8"),
  ) as GmailIdPayload;
  if (!payload.sub || !payload.email) {
    throw new Error("id_token missing sub/email");
  }
  return payload;
}
