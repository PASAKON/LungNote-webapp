import { NextResponse, type NextRequest } from "next/server";
import {
  exchangeCodeForTokens,
  STATE_COOKIE,
} from "@/lib/auth/line-oauth";
import { verifyLineIdToken } from "@/lib/auth/liff-verify";
import { upsertLineUserAndSetSession } from "@/lib/auth/line-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const errorParam = req.nextUrl.searchParams.get("error");

  if (errorParam) return errorRedirect(req, `line_${errorParam}`);
  if (!code || !state) return errorRedirect(req, "missing_code_or_state");

  const cookie = req.cookies.get(STATE_COOKIE)?.value ?? "";
  const [cookieState] = cookie.split(".");
  if (!cookieState || cookieState !== state) {
    return errorRedirect(req, "csrf_state_mismatch");
  }

  const redirectUri = new URL(
    "/api/auth/line/oauth/callback",
    siteUrl(req),
  ).toString();
  const tokens = await exchangeCodeForTokens({ code, redirectUri });
  if (!tokens.ok) return errorRedirect(req, tokens.error);

  const verified = await verifyLineIdToken(tokens.idToken);
  if (!verified.ok) return errorRedirect(req, verified.error);

  const session = await upsertLineUserAndSetSession(verified.claims);
  if (!session.ok) return errorRedirect(req, session.error);

  const dest = new URL("/dashboard", siteUrl(req));
  const res = NextResponse.redirect(dest);
  res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

function errorRedirect(req: NextRequest, code: string): NextResponse {
  const url = new URL("/auth/line/error", siteUrl(req));
  url.searchParams.set("code", code);
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

function siteUrl(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env;
  return new URL("/", req.url).toString();
}
