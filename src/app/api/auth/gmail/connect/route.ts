import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  STATE_COOKIE,
  STATE_TTL_SECONDS,
  buildAuthorizeUrl,
  isGmailScopeTier,
  newState,
} from "@/lib/gmail/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Require a LungNote session — Gmail is a secondary connection per ADR-0017.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/th/dashboard", req.url));
  }

  const redirectUri = redirectUriFor(req);
  const state = newState();
  const tierParam = req.nextUrl.searchParams.get("tier");
  const tier = isGmailScopeTier(tierParam) ? tierParam : "read";
  const url = buildAuthorizeUrl({ state, redirectUri, tier });

  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });
  return res;
}

function redirectUriFor(req: NextRequest): string {
  const envUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (envUri) return envUri;
  return new URL("/api/auth/gmail/callback", req.url).toString();
}
