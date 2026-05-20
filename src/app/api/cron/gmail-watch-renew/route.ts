import { NextResponse, type NextRequest } from "next/server";
import { renewExpiringWatches } from "@/lib/gmail/watch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/gmail-watch-renew
 *
 * Vercel cron `0 0 * * *` (daily). Renews any connection whose Gmail
 * users.watch() expires in < 24h. Watch lifetime is capped at 7d by Google,
 * so daily renewal keeps push subscriptions alive indefinitely.
 *
 * Auth: Bearer CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return new NextResponse("not_configured", { status: 500 });
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const summary = await renewExpiringWatches();
  return NextResponse.json({ ok: true, ...summary });
}
