import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { locales, defaultLocale } from "@/i18n/config";
import { updateSession } from "@/lib/supabase/middleware";

function getLocaleFromHeader(request: NextRequest): string {
  const accept = request.headers.get("accept-language") ?? "";
  const preferred = accept.split(",")[0]?.split("-")[0]?.toLowerCase() ?? "";
  return (locales as readonly string[]).includes(preferred)
    ? preferred
    : defaultLocale;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
