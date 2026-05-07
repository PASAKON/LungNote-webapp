import "server-only";

const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

export type LineIdTokenClaims = {
  iss: string;
  sub: string;          // LINE userId
  aud: string;
  exp: number;
  iat: number;
  amr?: string[];
  name?: string;
  picture?: string;
  email?: string;
};

export async function verifyLineIdToken(
  idToken: string,
): Promise<{ ok: true; claims: LineIdTokenClaims } | { ok: false; error: string }> {
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
    return { ok: false, error: `verify_failed_${res.status}` };
  }

  const claims = (await res.json()) as LineIdTokenClaims;
  if (!claims.sub) return { ok: false, error: "no_sub" };
  return { ok: true, claims };
}
