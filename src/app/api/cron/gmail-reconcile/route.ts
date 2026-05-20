import { NextResponse, type NextRequest } from "next/server";
import { syncAllActiveConnections } from "@/lib/gmail/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel Pro

/**
 * GET /api/cron/gmail-reconcile
 *
 * Vercel cron `0 * * * *` — safety net for ADR-0017 hybrid push+reconcile
 * model. Catches any emails that Pub/Sub dropped or webhook missed.
 * Idempotent via lungnote_gmail_synced_messages.unique(user_id, message_id).
 *
 * Auth: Bearer CRON_SECRET. Vercel cron auto-sends `Authorization: Bearer
 * <CRON_SECRET>` when the env var is set.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const results = await syncAllActiveConnections();
  const totals = results.reduce(
    (acc, r) => ({
      connections: acc.connections + 1,
      scanned: acc.scanned + r.scanned,
      todosCreated: acc.todosCreated + r.todosCreated,
      errors: acc.errors + (r.error ? 1 : 0),
    }),
    { connections: 0, scanned: 0, todosCreated: 0, errors: 0 },
  );

  return NextResponse.json({ ok: true, totals, results });
}

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${expected}`;
}
