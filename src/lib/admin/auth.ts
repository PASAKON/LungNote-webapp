import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin auth gate — used by every page under app/admin/*.
 *
 * Admin auth is independent of LINE LIFF. Admins log in with email +
 * password via Supabase. Allowlist comes from `ADMIN_EMAILS` env
 * (comma-separated). This way admin.lungnote.com works in any browser,
 * cookies stay host-scoped, and there's no overlap with the LIFF flow
 * that users go through on the apex.
 *
 * Returns the resolved admin profile or null. Pages should redirect to
 * /admin/login when null.
 */
export type AdminProfile = {
  userId: string;
  email: string;
};

function allowlist(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = allowlist();
  return allow.includes(email.toLowerCase());
}

export async function getAdminProfile(): Promise<AdminProfile | null> {
  const allow = allowlist();
  if (allow.length === 0) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  if (!allow.includes(user.email.toLowerCase())) return null;

  return { userId: user.id, email: user.email };
}
