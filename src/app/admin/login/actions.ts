"use server";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/admin/auth";
import { redirect } from "next/navigation";

export type LoginState = { error: string | null };

/**
 * Admin sign-in via Supabase email + password. After signing in, we
 * cross-check the user's email against `ADMIN_EMAILS` and immediately
 * sign them back out if they aren't on the allowlist — that way we
 * never grant an admin cookie to a non-admin account that happens to
 * exist in our Supabase project (e.g. a LIFF-synthesised user).
 */
export async function adminLogin(
  _prev: LoginState,
  form: FormData,
): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) {
    return { error: "Email + password required" };
  }
  if (!isEmailAllowed(email)) {
    // Don't even try Supabase — refuse early to avoid leaking which
    // emails exist in the auth table.
    return { error: "Invalid credentials" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Invalid credentials" };
  }

  // Defense in depth: re-read the user and verify the email matches.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !isEmailAllowed(user.email)) {
    await supabase.auth.signOut();
    return { error: "Not authorised" };
  }

  redirect("/");
}

export async function adminLogout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
