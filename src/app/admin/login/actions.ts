"use server";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/admin/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { LoginState } from "./state";

/**
 * Admin sign-in via Supabase magic link (one-time email).
 *
 * Security choices:
 *   - shouldCreateUser:false — never auto-provision admins. They must
 *     be pre-created in Supabase auth.
 *   - Allowlist check (ADMIN_EMAILS env) BEFORE sending — never reach
 *     out to a non-admin address, and never leak which addresses are
 *     allowlisted vs not (we always respond "sent" if input is a valid
 *     email shape, error if not).
 *   - Allowlist re-check in callback so even if the email service is
 *     compromised, a stray sign-in won't grant the admin session.
 */
export async function adminLogin(
  _prev: LoginState,
  form: FormData,
): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", error: "ใส่ email ที่ถูกต้อง" };
  }

  // Silent allowlist check — don't tell the user whether their email
  // is on the list. They get the same "sent" response either way.
  if (!isEmailAllowed(email)) {
    return { status: "sent", error: null };
  }

  // Build the absolute URL for the magic-link callback. headers() so
  // local dev hits localhost, preview hits the *.vercel.app, prod hits
  // admin.lungnote.com.
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "admin.lungnote.com";
  const emailRedirectTo = `${proto}://${host}/auth/callback`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo,
    },
  });
  if (error) {
    console.error("adminLogin signInWithOtp error", error.message);
    // Still return "sent" — don't reveal whether the email exists.
    return { status: "sent", error: null };
  }
  return { status: "sent", error: null };
}

export async function adminLogout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
