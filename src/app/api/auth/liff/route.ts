import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { verifyLineIdToken } from "@/lib/auth/liff-verify";
import { syntheticEmailFromLineUserId } from "@/lib/auth/synthetic-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dbg(step: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ tag: "liff_auth", ts: Date.now(), step, ...data }));
}

export async function POST(req: NextRequest) {
  dbg("start");
  let body: { idToken?: string };
  try {
    body = (await req.json()) as { idToken?: string };
  } catch {
    dbg("invalid_json");
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const idToken = body.idToken;
  if (!idToken) {
    dbg("missing_id_token");
    return NextResponse.json({ error: "missing_id_token" }, { status: 400 });
  }

  const verified = await verifyLineIdToken(idToken);
  dbg("verify_id_token", { ok: verified.ok, error: verified.ok ? null : verified.error });
  if (!verified.ok) {
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
  const cookieStore = await cookies();
  const stale = cookieStore.getAll().filter((c) => c.name.startsWith("sb-"));
  for (const c of stale) cookieStore.delete(c.name);
  dbg("stale_cookies_cleared", { count: stale.length });

  const supabase = await createServerClient();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  dbg("verify_otp", { ok: !verifyErr, error: verifyErr?.message });
  if (verifyErr) {
    return NextResponse.json(
      { error: "session_set_failed", detail: verifyErr.message },
      { status: 500 },
    );
  }

  dbg("done", { userId });
  return NextResponse.json({ ok: true, userId });
}
