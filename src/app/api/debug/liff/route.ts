import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Client-side debug breadcrumbs from the LIFF flow.
 *
 * Usage from LiffClient.tsx:
 *   navigator.sendBeacon("/api/debug/liff", JSON.stringify({step, data}))
 *
 * Lands as a single structured `console.log` line per call — searchable
 * in `vercel logs --query "liff_debug"`.
 *
 * Hardening (OWASP audit 2026-05-11):
 *  - Gated behind `DEBUG_LIFF_ENABLED=true` so prod is off by default.
 *    Once LIFF stability work is done the endpoint can be deleted —
 *    toggling the env is the kill switch in the meantime.
 *  - Body size cap (8 KB) so anonymous spam can't blow up logs.
 *  - `step` is restricted to `^[a-z0-9_]{1,40}$` so an attacker can't
 *    forge fake tags ("login_success", "admin_action", etc.) and drown
 *    out real signal in the log stream.
 *  - Per-IP in-memory rate limit (60 req / min). Single-process / per-
 *    instance only — good enough to slow a casual attacker; for real
 *    DoS protection rely on Vercel's edge limits.
 */

const ENABLED = process.env.DEBUG_LIFF_ENABLED === "true";
const MAX_BODY_BYTES = 8 * 1024;
const STEP_RE = /^[a-z0-9_]{1,40}$/;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  b.count += 1;
  return b.count > RATE_LIMIT_MAX;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!ENABLED) {
    return NextResponse.json({ ok: false, reason: "disabled" }, { status: 404 });
  }

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 });
  }

  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, reason: "too_large" },
        { status: 413 },
      );
    }
    const body = JSON.parse(raw) as { step?: unknown; data?: unknown };
    const step =
      typeof body.step === "string" && STEP_RE.test(body.step)
        ? body.step
        : "invalid_step";
    const data = body.data ?? null;
    const ua = req.headers.get("user-agent") ?? "";
    console.log(
      JSON.stringify({
        tag: "liff_debug",
        ts: Date.now(),
        step,
        data,
        ua: ua.slice(0, 200),
      }),
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function GET(): Promise<NextResponse> {
  if (!ENABLED) {
    return NextResponse.json({ ok: false, reason: "disabled" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, note: "POST debug events here" });
}
