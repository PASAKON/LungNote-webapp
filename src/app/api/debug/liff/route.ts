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
 * in `vercel logs --query "liff_debug"`. No DB write; cheap to keep on
 * while debugging, easy to rip out later.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as { step?: string; data?: unknown };
    const step = body.step ?? "unknown";
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
  return NextResponse.json({ ok: true, note: "POST debug events here" });
}
