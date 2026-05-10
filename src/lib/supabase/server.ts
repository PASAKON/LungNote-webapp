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

  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // Bypass @supabase/ssr's default base64url encoder — it throws
      // "Invalid UTF-8 sequence" once a session cookie holds certain
      // byte patterns (https://github.com/supabase/ssr/issues/67).
      // Server + browser + middleware must all use the same encoding.
      cookieEncoding: "raw",
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

  // Wrap auth.getUser so a stale-refresh failure NEVER throws inside a
  // Server Component page render. Refresh rotation in pages is doomed
  // (Server Components can't write cookies — setAll above silently
  // swallows), so when the next call uses the now-invalid refresh_token
  // Supabase throws AuthApiError. We catch and return { user: null }
  // so the page's existing redirect/empty-state logic handles re-auth
  // cleanly. Middleware is the one place where refresh + cookie write
  // actually works.
  const originalGetUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = (async () => {
    try {
      return await originalGetUser();
    } catch (err) {
      console.log(
        JSON.stringify({
          tag: "supabase_server",
          ts: Date.now(),
          step: "get_user_swallowed",
          msg: err instanceof Error ? err.message : String(err),
        }),
      );
      return {
        data: { user: null },
        error: null,
      } as unknown as Awaited<ReturnType<typeof originalGetUser>>;
    }
  }) as typeof client.auth.getUser;

  return client;
}
