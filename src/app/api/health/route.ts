import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const checks: Record<string, { ok: boolean; ms?: number; detail?: string }> =
    {};

  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_PROJECT_REF",
  ] as const;

  checks.env = {
    ok: required.every((k) => !!process.env[k]),
    detail: required.filter((k) => !process.env[k]).join(",") || undefined,
  };

  try {
    const t0 = Date.now();
    const supabase = await createClient();
    const { error } = await supabase.auth.getUser();
    checks.supabase = {
      ok: !error,
      ms: Date.now() - t0,
      detail: error?.message,
    };
  } catch (err) {
    checks.supabase = {
      ok: false,
      detail: err instanceof Error ? err.message : "unknown",
    };
  }

  const ok = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    {
      ok,
      checks,
      totalMs: Date.now() - startedAt,
      env: process.env.VERCEL_ENV ?? "local",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
    { status: ok ? 200 : 503 },
  );
}
