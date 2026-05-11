import "server-only";

const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

export type LineIdTokenClaims = {
  iss: string;
  sub: string; // LINE userId
  aud: string;
  exp: number;
  iat: number;
  amr?: string[];
  name?: string;
  picture?: string;
  email?: string;
};

export type VerifyResult =
  | { ok: true; claims: LineIdTokenClaims }
  | {
      ok: false;
      error: string;
      /** Diagnostic detail — surfaced to the route logger only, never to the client. */
      diag?: {
        status: number;
        line_error?: string;
        line_error_description?: string;
        token_aud?: string;
        token_iss?: string;
        token_exp?: number;
        env_channel_id?: string;
      };
    };

/** Decode a JWT payload without verifying the signature — diagnostic only. */
function peekJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function verifyLineIdToken(idToken: string): Promise<VerifyResult> {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) return { ok: false, error: "missing_channel_id" };

  const body = new URLSearchParams({
    id_token: idToken,
    client_id: channelId,
  });

  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    // LINE returns a small JSON body on error with `error` +
    // `error_description`. Capture it for diagnostics — without this we
    // only see "verify_failed_400" in the logs and can't tell whether
    // it's a channel-mismatch, expired token, or malformed id_token.
    let lineError: string | undefined;
    let lineErrorDescription: string | undefined;
    try {
      const errBody = (await res.json()) as {
        error?: string;
        error_description?: string;
      };
      lineError = errBody.error;
      lineErrorDescription = errBody.error_description;
    } catch {
      /* not JSON — leave undefined */
    }

    const payload = peekJwtPayload(idToken);
    const diag = {
      status: res.status,
      line_error: lineError,
      line_error_description: lineErrorDescription,
      token_aud: typeof payload?.aud === "string" ? payload.aud : undefined,
      token_iss: typeof payload?.iss === "string" ? payload.iss : undefined,
      token_exp: typeof payload?.exp === "number" ? payload.exp : undefined,
      env_channel_id: channelId,
    };

    return { ok: false, error: `verify_failed_${res.status}`, diag };
  }

  const claims = (await res.json()) as LineIdTokenClaims;
  if (!claims.sub) return { ok: false, error: "no_sub" };
  return { ok: true, claims };
}
