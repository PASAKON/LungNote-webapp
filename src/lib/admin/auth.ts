import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin auth gate — used by every page under app/admin/*.
 *
 * Flow:
 *   1. Read Supabase session via cookie-aware ssr client.
 *   2. Look up the user's lungnote_profiles row (via admin client because
 *      profiles RLS scopes to auth.uid which would block our cross-check).
 *   3. Check `line_user_id` against ADMIN_LINE_USER_IDS env (comma-separated).
 *
 * Returns the resolved admin profile or null. Pages should redirect to the
 * LIFF/auth-line login flow when null.
 */
export type AdminProfile = {
  userId: string;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
};

export async function getAdminProfile(): Promise<AdminProfile | null> {
  const allowList = (process.env.ADMIN_LINE_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowList.length === 0) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const sb = createAdminClient();
  const { data: profile, error } = await sb
    .from("lungnote_profiles")
    .select("id, line_user_id, line_display_name, line_picture_url")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) return null;
  if (!allowList.includes(profile.line_user_id)) return null;

  return {
    userId: profile.id,
    lineUserId: profile.line_user_id,
    displayName: profile.line_display_name,
    pictureUrl: profile.line_picture_url,
  };
}
