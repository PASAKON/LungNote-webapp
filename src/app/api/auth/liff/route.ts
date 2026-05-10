import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { verifyLineIdToken } from "@/lib/auth/liff-verify";
import { syntheticEmailFromLineUserId } from "@/lib/auth/synthetic-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Collect breadcrumbs into one array + emit a single console.log line at
// the end of the handler. Vercel serverless logs can drop intermediate
// console.log lines on cold start; one final flush is reliable.
type Crumb = { step: string; t: number; data?: Record<string, unknown> };
function makeRecorder() {
  const start = Date.now();
  const crumbs: Crumb[] = [];
  return {
    dbg(step: string, data: Record<string, unknown> = {}) {
      crumbs.push({ step, t: Date.now() - start, data });
    },
    flush(extra: Record<string, unknown> = {}) {
      console.log(
        JSON.stringify({
          tag: "liff_auth",
          start_ts: start,
          duration_ms: Date.now() - start,
          ...extra,
          crumbs,
        }),
      );
    },
  };
}

export async function POST(req: NextRequest) {
  const rec = makeRecorder();
  const dbg = rec.dbg;
  dbg("start");
  let body: { idToken?: string };
  try {
    body = (await req.json()) as { idToken?: string };
  } catch {
    dbg("invalid_json");
    rec.flush({ outcome: "invalid_json" });
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const idToken = body.idToken;
  if (!idToken) {
    dbg("missing_id_token");
    rec.flush({ outcome: "missing_id_token" });
    return NextResponse.json({ error: "missing_id_token" }, { status: 400 });
  }

  const verified = await verifyLineIdToken(idToken);
  dbg("verify_id_token", { ok: verified.ok, error: verified.ok ? null : verified.error });
  if (!verified.ok) {
    rec.flush({ outcome: verified.error });
    return NextResponse.json({ error: verified.error }, { status: 401 });
  }

  const lineUserId = verified.claims.sub;
  const email = syntheticEmailFromLineUserId(lineUserId);
  const displayName = verified.claims.name ?? null;
  const pictureUrl = verified.claims.picture ?? null;

  const admin = createAdminClient();

  const { data: profileRow } = await admin
    .from("lungnote_profiles")
    .select("id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  let userId: string;
  if (profileRow?.id) {
    userId = profileRow.id;
    dbg("profile_existing", { userId });
    if (displayName || pictureUrl) {
      await admin
        .from("lungnote_profiles")
        .update({
          line_display_name: displayName,
          line_picture_url: pictureUrl,
        })
        .eq("id", userId);
    }
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        provider: "line",
        line_user_id: lineUserId,
        display_name: displayName,
      },
    });
    if (createErr || !created.user) {
      dbg("create_user_failed", { error: createErr?.message });
      rec.flush({ outcome: "create_user_failed" });
      return NextResponse.json(
        { error: "create_user_failed", detail: createErr?.message },
        { status: 500 },
      );
    }
    userId = created.user.id;
    dbg("profile_new", { userId });

    await admin.from("lungnote_profiles").insert({
      id: userId,
      line_user_id: lineUserId,
      line_display_name: displayName,
      line_picture_url: pictureUrl,
    });
  }

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  dbg("magic_link", {
    ok: !linkErr && !!linkData.properties?.hashed_token,
    error: linkErr?.message,
  });
  if (linkErr || !linkData.properties?.hashed_token) {
    rec.flush({ outcome: "magic_link_failed" });
    return NextResponse.json(
      { error: "magic_link_failed", detail: linkErr?.message },
      { status: 500 },
    );
  }

  // Clear any stale Supabase auth cookies before verifyOtp. If a previous
  // LIFF session left an expired refresh token cookie, the SSR client
  // throws "Invalid Refresh Token: Refresh Token Not Found" before our
  // new session can be set. Wiping the sb-* cookies first lets verifyOtp
  // create the new session cleanly.
  // Domain-aware cookie clear. Production sets sb-* cookies on
  // .lungnote.com so admin.lungnote.com + www share the session.
  // cookies().delete(name) without domain only kills host-scoped
  // cookies, leaving the domain-scoped one. Set value="" + maxAge=0
  // + matching domain to evict properly. Otherwise the browser keeps
  // serving the stale refresh_token on the next page render.
  const cookieStore = await cookies();
  const COOKIE_DOMAIN =
    process.env.VERCEL_ENV === "production" ? ".lungnote.com" : undefined;
  const stale = cookieStore.getAll().filter((c) => c.name.startsWith("sb-"));
  for (const c of stale) {
    cookieStore.set(c.name, "", {
      path: "/",
      maxAge: 0,
      ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
    });
    // Also kill the host-scoped variant if any exists.
    cookieStore.set(c.name, "", { path: "/", maxAge: 0 });
  }
  dbg("stale_cookies_cleared", { count: stale.length, domain: COOKIE_DOMAIN ?? "host" });

  const supabase = await createServerClient();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  dbg("verify_otp", { ok: !verifyErr, error: verifyErr?.message });
  if (verifyErr) {
    rec.flush({ outcome: "session_set_failed" });
    return NextResponse.json(
      { error: "session_set_failed", detail: verifyErr.message },
      { status: 500 },
    );
  }

  // Verify cookies actually wrote to the response. If verifyOtp's setAll
  // callback was suppressed (Server Component try/catch), session cookies
  // are missing and the dashboard render will refresh-fail.
  const finalCookies = (await cookies())
    .getAll()
    .filter((c) => c.name.startsWith("sb-"))
    .map((c) => ({ name: c.name, len: c.value.length }));
  dbg("session_cookies_present", { count: finalCookies.length, cookies: finalCookies });
  dbg("done", { userId });
  rec.flush({ outcome: "ok", userId });
  return NextResponse.json({ ok: true, userId });
}
