import { NextResponse, type NextRequest } from "next/server";
import {
  buildAuthorizeUrl,
  newStateAndNonce,
  STATE_COOKIE,
  STATE_TTL_SECONDS,
} from "@/lib/auth/line-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const { state, nonce } = newStateAndNonce();
  const redirectUri = new URL(
    "/api/auth/line/oauth/callback",
    siteUrl(req),
  ).toString();

  const url = buildAuthorizeUrl({ state, nonce, redirectUri });
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, `${state}.${nonce}`, {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });
  return res;
}

function siteUrl(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env;
  return new URL("/", req.url).toString();
}
