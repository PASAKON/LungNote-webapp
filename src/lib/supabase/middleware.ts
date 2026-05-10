import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth cookie domain — TEMPORARILY DISABLED to isolate the LIFF
 * login regression. With this undefined, cookies are host-scoped
 * (lungnote.com only). admin.lungnote.com loses session sharing
 * and needs its own login flow. Was: .lungnote.com in production.
 */
const COOKIE_DOMAIN: string | undefined = undefined;

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // See lib/supabase/server.ts and lib/supabase/client.ts —
      // cookieEncoding "raw" must match across all three clients to
      // dodge supabase/ssr#67 ("Invalid UTF-8 sequence").
      cookieEncoding: "raw",
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            const opts = COOKIE_DOMAIN
              ? { ...options, domain: COOKIE_DOMAIN }
              : options;
            response.cookies.set(name, value, opts);
          }
        },
      },
    },
  );

  // getUser auto-refreshes if access_token expired. If the refresh
  // token is invalid (rotated / orphaned), Supabase throws and the
  // middleware would 500 on every page render. Swallow the error +
  // clear the stale sb-* cookies so the user can re-auth cleanly.
  try {
    await supabase.auth.getUser();
  } catch (err) {
    // Dump the offending cookies so we can see what Supabase choked on.
    const cookieDump = request.cookies
      .getAll()
      .filter((c) => c.name.startsWith("sb-"))
      .map((c) => ({
        name: c.name,
        len: (c.value ?? "").length,
        prefix: (c.value ?? "").slice(0, 40),
      }));
    console.log(
      JSON.stringify({
        tag: "liff_auth",
        ts: Date.now(),
        step: "middleware_refresh_error",
        msg: err instanceof Error ? err.message : String(err),
        cookies: cookieDump,
      }),
    );
    for (const c of request.cookies.getAll()) {
      if (c.name.startsWith("sb-")) {
        response.cookies.set(c.name, "", {
          path: "/",
          maxAge: 0,
          ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
        });
        response.cookies.set(c.name, "", { path: "/", maxAge: 0 });
      }
    }
  }

  return response;
}
