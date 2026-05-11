/**
 * Admin setup — create admin user(s) in Supabase auth.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/admin-setup.ts <email>
 *
 * Idempotent: if the user already exists, prints existing id.
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("usage: tsx scripts/admin-setup.ts <email>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY required in .env.local",
    );
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Check if user exists. Supabase admin API has no "find by email"
  // directly; list users + filter.
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    console.error("listUsers error:", listErr.message);
    process.exit(1);
  }
  const existing = list.users.find((u) => u.email === email);
  if (existing) {
    console.log(`✓ already exists: ${email} (id=${existing.id})`);
    process.exit(0);
  }

  // Create user with email_confirm=true so they can sign in immediately
  // via magic link (no need to verify a confirmation email first).
  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email,
      email_confirm: true,
      user_metadata: { role: "admin", provisioned_via: "admin-setup-script" },
    },
  );
  if (createErr || !created.user) {
    console.error("createUser error:", createErr?.message);
    process.exit(1);
  }

  console.log(`✓ created: ${email} (id=${created.user.id})`);
  console.log("\nNext steps:");
  console.log(`  1. Add to Vercel env: ADMIN_EMAILS=${email}`);
  console.log("  2. Add Supabase redirect URL: https://admin.lungnote.com/auth/callback");
  console.log("  3. Visit https://admin.lungnote.com/login");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
