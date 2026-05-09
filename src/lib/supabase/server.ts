import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

// Auth cookie domain — `.lungnote.com` in production so admin.lungnote.com
// and lungnote.com share a session. Preview/dev keep cookies host-scoped.
const COOKIE_DOMAIN =
  process.env.VERCEL_ENV === "production" ? ".lungnote.com" : undefined;

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              const opts = COOKIE_DOMAIN
                ? { ...options, domain: COOKIE_DOMAIN }
                : options;
              cookieStore.set(name, value, opts);
            }
          } catch {
            // setAll called from a Server Component — middleware refreshes the session
          }
        },
      },
    },
  );
}
