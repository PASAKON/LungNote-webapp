import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Domain attached to auth cookies in production so admin.lungnote.com and
 * lungnote.com share a single session. Preview deployments use *.vercel.app
 * which can't share with the apex; we leave cookies host-scoped there.
 */
const COOKIE_DOMAIN =
  process.env.VERCEL_ENV === "production" ? ".lungnote.com" : undefined;

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
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

  await supabase.auth.getUser();

  return response;
}
