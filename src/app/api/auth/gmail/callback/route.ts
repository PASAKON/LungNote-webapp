import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  STATE_COOKIE,
  exchangeCode,
  parseIdTokenPayload,
} from "@/lib/gmail/oauth";
import { encryptToken } from "@/lib/gmail/crypto";
import { startGmailWatchForUser } from "@/lib/gmail/watch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const settingsUrl = new URL("/th/dashboard/settings", req.url);

  // 1. Require an authenticated LungNote user
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    settingsUrl.searchParams.set("gmail", "auth_required");
    return NextResponse.redirect(settingsUrl);
  }

  // 2. CSRF state check
  const url = req.nextUrl;
  const stateParam = url.searchParams.get("state");
  const stateCookie = req.cookies.get(STATE_COOKIE)?.value;
  const errorParam = url.searchParams.get("error");
  const code = url.searchParams.get("code");

  if (errorParam) {
    settingsUrl.searchParams.set("gmail", `error_${errorParam}`);
    return clearStateAndRedirect(settingsUrl);
  }
  if (!stateParam || !stateCookie || stateParam !== stateCookie) {
    settingsUrl.searchParams.set("gmail", "state_mismatch");
    return clearStateAndRedirect(settingsUrl);
  }
  if (!code) {
    settingsUrl.searchParams.set("gmail", "missing_code");
    return clearStateAndRedirect(settingsUrl);
  }

  // 3. Exchange code → tokens
  let tokens;
  try {
    tokens = await exchangeCode({
      code,
      redirectUri: redirectUriFor(req),
    });
  } catch {
    settingsUrl.searchParams.set("gmail", "exchange_failed");
    return clearStateAndRedirect(settingsUrl);
  }

  if (!tokens.refresh_token) {
    // Google withholds refresh_token if user already consented without prompt.
    // Our buildAuthorizeUrl forces prompt=consent, so this is exceptional.
    settingsUrl.searchParams.set("gmail", "no_refresh_token");
    return clearStateAndRedirect(settingsUrl);
  }

  // 4. Parse identity from id_token (TLS-authenticated channel)
  let idPayload;
  try {
    idPayload = parseIdTokenPayload(tokens.id_token ?? "");
  } catch {
    settingsUrl.searchParams.set("gmail", "id_token_failed");
    return clearStateAndRedirect(settingsUrl);
  }

  // 5. Two-step upsert so AAD = row id can bind the ciphertext.
  //    a) upsert metadata only with placeholder bytea → fetch row id
  //    b) UPDATE with encrypted tokens using AAD = row id
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { data: upserted, error: upsertErr } = await supabase
    .from("lungnote_gmail_connections")
    .upsert(
      {
        user_id: user.id,
        google_user_id: idPayload.sub,
        email: idPayload.email,
        scope: tokens.scope,
        status: "active",
        last_error: null,
        refresh_token_enc: Buffer.alloc(0), // placeholder, replaced step b
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .single();

  if (upsertErr || !upserted?.id) {
    settingsUrl.searchParams.set("gmail", "db_upsert_failed");
    return clearStateAndRedirect(settingsUrl);
  }

  const aad = `lungnote_gmail_connections:${upserted.id}`;
  const refreshEnc = encryptToken(tokens.refresh_token, aad);
  const accessEnc = encryptToken(tokens.access_token, aad);

  const { error: updateErr } = await supabase
    .from("lungnote_gmail_connections")
    .update({
      refresh_token_enc: refreshEnc,
      access_token_enc: accessEnc,
      access_token_expires_at: expiresAt,
    })
    .eq("id", upserted.id);

  if (updateErr) {
    settingsUrl.searchParams.set("gmail", "db_token_save_failed");
    return clearStateAndRedirect(settingsUrl);
  }

  // Start Gmail push watch — best-effort. If it fails, the row stays
  // active and the reconcile cron will still catch new email; the
  // watch-renew cron will retry on its next tick.
  await startGmailWatchForUser(user.id);

  settingsUrl.searchParams.set("gmail", "connected");
  return clearStateAndRedirect(settingsUrl);
}

function clearStateAndRedirect(target: URL) {
  const res = NextResponse.redirect(target);
  res.cookies.delete(STATE_COOKIE);
  return res;
}

function redirectUriFor(req: NextRequest): string {
  const envUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (envUri) return envUri;
  return new URL("/api/auth/gmail/callback", req.url).toString();
}
