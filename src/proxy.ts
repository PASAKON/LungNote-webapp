import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { locales, defaultLocale } from "@/i18n/config";
import { updateSession } from "@/lib/supabase/middleware";

const LOCALE_FREE_PREFIXES = ["/auth", "/liff"];
const ADMIN_HOSTS = new Set([
  "admin.lungnote.com",
  // local + vercel preview convenience
  "admin.localhost",
  "admin.localhost:3000",
]);

function getLocaleFromHeader(request: NextRequest): string {
  const accept = request.headers.get("accept-language") ?? "";
  const preferred = accept.split(",")[0]?.split("-")[0]?.toLowerCase() ?? "";
  return (locales as readonly string[]).includes(preferred)
    ? preferred
    : defaultLocale;
}

/**
 * Subdomain split:
 *   admin.lungnote.com  → rewrite path → `/admin/*`, no locale prefix
 *   www.lungnote.com    → existing landing/dashboard locale flow
 *
 * Auth for admin routes is enforced in `app/admin/layout.tsx` (line userId
 * allowlist via ADMIN_LINE_USER_IDS env). Middleware only handles routing.
 */
export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  // ── Admin subdomain ─────────────────────────────────────────────────
  if (ADMIN_HOSTS.has(host)) {
    // Already under /admin? just refresh session and continue.
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      return updateSession(request);
    }
    const url = request.nextUrl.clone();
    url.pathname =
      pathname === "/" ? "/admin" : `/admin${pathname}`;
    return NextResponse.rewrite(url);
  }

  // ── Public (lungnote.com) ───────────────────────────────────────────
  // Block direct hits to /admin paths from the public host — admin only
  // ships under admin.lungnote.com.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const isLocaleFree = LOCALE_FREE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (isLocaleFree) return updateSession(request);

  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );

  if (!hasLocale) {
    const locale = getLocaleFromHeader(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(url);
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
