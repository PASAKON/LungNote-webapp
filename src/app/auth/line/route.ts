import { NextResponse, type NextRequest } from "next/server";
import { redeemToken } from "@/lib/auth/line-link";
import { syntheticEmailFromLineUserId } from "@/lib/auth/synthetic-email";
import { getLineProfile } from "@/lib/line/profile";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const { data: profileRow } = (await admin
    .from("lungnote_profiles")
    .select("id")
    .eq("line_user_id", lineUserId)
    .maybeSingle()) as { data: { id: string } | null };

  let userId: string;
  if (profileRow?.id) {
    userId = profileRow.id;
    // refresh profile fields
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
    // create auth user
    const { data: created, error: createErr } = await admin.auth.admin.createUser(
      {
        email,
        email_confirm: true,
        user_metadata: {
          provider: "line",
          line_user_id: lineUserId,
          display_name: profile?.displayName ?? null,
        },
      },
    );
    if (createErr || !created.user) {
      return errorRedirect(req, "create_user_failed");
    }
    userId = created.user.id;

    // upsert profile row
    await admin.from("lungnote_profiles").insert({
      id: userId,
      line_user_id: lineUserId,
      line_display_name: profile?.displayName ?? null,
      line_picture_url: profile?.pictureUrl ?? null,
    });
  }

  // mint magic link → redirect browser to Supabase verify URL → cookie set → /dashboard
  const redirectTo = new URL("/dashboard", siteUrl(req)).toString();
  const { data: linkData, error: linkErr } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

  if (linkErr || !linkData.properties?.action_link) {
    return errorRedirect(req, "magic_link_failed");
  }

  return NextResponse.redirect(linkData.properties.action_link);
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
