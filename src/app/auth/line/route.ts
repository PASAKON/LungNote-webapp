import { NextResponse, type NextRequest } from "next/server";
import { redeemToken } from "@/lib/auth/line-link";
import { syntheticEmailFromLineUserId } from "@/lib/auth/synthetic-email";
import { getLineProfile } from "@/lib/line/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");
  if (!token) return errorRedirect(req, "missing_token");

  const redeemed = await redeemToken(token);
  if (!redeemed) return errorRedirect(req, "invalid_or_expired");

  const { lineUserId } = redeemed;
  const email = syntheticEmailFromLineUserId(lineUserId);
  const profile = await getLineProfile(lineUserId);

  const admin = createAdminClient();

  const { data: profileRow } = await admin
    .from("lungnote_profiles")
    .select("id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  let userId: string;
  if (profileRow?.id) {
    userId = profileRow.id;
    if (profile) {
      await admin
        .from("lungnote_profiles")
        .update({
          line_display_name: profile.displayName,
          line_picture_url: profile.pictureUrl ?? null,
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
        display_name: profile?.displayName ?? null,
      },
    });
    if (createErr || !created.user) {
      return errorRedirect(req, "create_user_failed");
    }
    userId = created.user.id;

    await admin.from("lungnote_profiles").insert({
      id: userId,
      line_user_id: lineUserId,
      line_display_name: profile?.displayName ?? null,
      line_picture_url: profile?.pictureUrl ?? null,
    });
  }

  // Mint a magic-link, but DO NOT redirect the browser to the Supabase
  // verify endpoint (which would land at the project Site URL with
  // #access_token=… fragment). Instead, take the hashed_token and verify
  // it server-side via our cookie-aware @supabase/ssr client — that sets
  // the auth cookies on this response, then we redirect to /dashboard
  // ourselves.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !linkData.properties?.hashed_token) {
    return errorRedirect(req, "magic_link_failed");
  }

  const supabase = await createServerClient();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyErr) {
    return errorRedirect(req, "verify_failed");
  }

  return NextResponse.redirect(new URL("/dashboard", siteUrl(req)));
}

function errorRedirect(req: NextRequest, code: string): NextResponse {
  const url = new URL("/auth/line/error", siteUrl(req));
  url.searchParams.set("code", code);
  return NextResponse.redirect(url);
}

function siteUrl(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env;
  return new URL("/", req.url).toString();
}
