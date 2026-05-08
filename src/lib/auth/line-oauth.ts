import "server-only";
import { randomBytes } from "node:crypto";

const AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";

export const STATE_COOKIE = "lungnote_oauth_state";
export const STATE_TTL_SECONDS = 5 * 60;

export function buildAuthorizeUrl(opts: {
  state: string;
  nonce: string;
  redirectUri: string;
}): string {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) throw new Error("missing LINE_LOGIN_CHANNEL_ID");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: channelId,
    redirect_uri: opts.redirectUri,
    state: opts.state,
    scope: "openid profile",
    nonce: opts.nonce,
    bot_prompt: "aggressive",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export function newStateAndNonce(): { state: string; nonce: string } {
  return {
    state: randomBytes(16).toString("base64url"),
    nonce: randomBytes(16).toString("base64url"),
  };
}

export async function exchangeCodeForTokens(opts: {
  code: string;
  redirectUri: string;
}): Promise<
  | { ok: true; idToken: string; accessToken: string }
  | { ok: false; error: string }
> {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
  if (!channelId || !channelSecret) {
    return { ok: false, error: "missing_channel_credentials" };
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: channelId,
    client_secret: channelSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    return { ok: false, error: `token_exchange_failed_${res.status}` };
  }

  const data = (await res.json()) as {
    access_token?: string;
    id_token?: string;
  };
  if (!data.id_token || !data.access_token) {
    return { ok: false, error: "missing_tokens_in_response" };
  }
  return { ok: true, idToken: data.id_token, accessToken: data.access_token };
}
