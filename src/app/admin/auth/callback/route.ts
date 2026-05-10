import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/admin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Magic-link callback for admin sign-in.
 *
 * Supabase redirects here with `token_hash` + `type=email` (or
 * `type=magiclink`) after the admin taps the link in their email.
 * We:
 *   1. verifyOtp → create session cookies
 *   2. re-check user email is on ADMIN_EMAILS allowlist (defence in
 *      depth — if email service was compromised, this still blocks
 *      stray sign-ins)
 *   3. redirect / on success, /login?error=denied on failure
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(req.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "email";

  if (!tokenHash) {
    return NextResponse.redirect(`${origin}/login?error=missing_token`);
  }

  const supabase = await createClient();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as "email" | "magiclink",
  });
  if (verifyErr) {
    console.error("admin callback verifyOtp", verifyErr.message);
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !isEmailAllowed(user.email)) {
    // Email signed in but it's not on the admin allowlist — eject.
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=denied`);
  }

  return NextResponse.redirect(`${origin}/`);
}
