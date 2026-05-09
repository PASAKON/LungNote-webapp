import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type TraceRow = {
  id: string;
  trace_id: string;
  line_user_id: string | null;
  user_text: string;
  path: "dashboard" | "list" | "memory" | "regex" | "ai" | "error";
  history_count: number;
  ai_iterations: number;
  tool_calls: unknown;
  reply_text: string | null;
  meta: unknown;
  error_text: string | null;
  created_at: string;
};

export type TraceFilters = {
  user?: string;
  path?: TraceRow["path"];
  q?: string;
  limit?: number;
  offset?: number;
};

/** Fetch a paginated trace list with optional filters. */
export async function listTraces(filters: TraceFilters = {}): Promise<TraceRow[]> {
  const sb = createAdminClient();
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  let q = sb
    .from("lungnote_chat_traces")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.user) q = q.eq("line_user_id", filters.user);
  if (filters.path) q = q.eq("path", filters.path);
  if (filters.q) q = q.ilike("user_text", `%${filters.q}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as TraceRow[];
}

/** Fetch one trace row by LINE message trace_id (NOT the row uuid). */
export async function getTraceByTraceId(
  traceId: string,
): Promise<TraceRow | null> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("lungnote_chat_traces")
    .select("*")
    .eq("trace_id", traceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as TraceRow | null) ?? null;
}

/** Fetch one trace by id (uuid). */
export async function getTrace(id: string): Promise<TraceRow | null> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("lungnote_chat_traces")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return (data as TraceRow | null) ?? null;
}

/** 24h summary for the admin home dashboard. */
export type AdminSummary = {
  total24h: number;
  byPath: Array<{ path: TraceRow["path"]; count: number }>;
  errors24h: number;
  uniqueUsers24h: number;
  totalCostUsd24h: number;
  recentErrors: TraceRow[];
};

export async function getAdminSummary(): Promise<AdminSummary> {
  const sb = createAdminClient();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // 1. Pull all traces for the last 24h. Volume should stay tiny (a few
  //    hundred at most for a 2-admin beta) so we can aggregate in JS rather
  //    than firing six different SQL queries.
  const { data: rows, error } = await sb
    .from("lungnote_chat_traces")
    .select("path, line_user_id, meta, error_text, user_text, trace_id, id, reply_text, created_at, history_count, ai_iterations, tool_calls")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const all = (rows ?? []) as TraceRow[];
  const byPathMap = new Map<TraceRow["path"], number>();
  const userSet = new Set<string>();
  let totalCost = 0;
  const errors: TraceRow[] = [];
  for (const r of all) {
    byPathMap.set(r.path, (byPathMap.get(r.path) ?? 0) + 1);
    if (r.line_user_id) userSet.add(r.line_user_id);
    const meta = r.meta as { cost_usd?: number } | null;
    if (typeof meta?.cost_usd === "number") totalCost += meta.cost_usd;
    if (r.path === "error" || r.error_text) errors.push(r);
  }

  return {
    total24h: all.length,
    byPath: Array.from(byPathMap, ([path, count]) => ({ path, count })).sort(
      (a, b) => b.count - a.count,
    ),
    errors24h: errors.length,
    uniqueUsers24h: userSet.size,
    totalCostUsd24h: totalCost,
    recentErrors: errors.slice(0, 5),
  };
}
