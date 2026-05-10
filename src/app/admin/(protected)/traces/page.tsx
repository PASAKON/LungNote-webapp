import Link from "next/link";
import { redirect } from "next/navigation";
import {
  listTraces,
  getTraceByTraceId,
  type TraceRow,
} from "@/lib/admin/traces";
import { TracePathPill, formatRelative } from "../_widgets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = {
  user?: string;
  path?: TraceRow["path"];
  q?: string;
  page?: string;
  tid?: string;
};

const PAGE_SIZE = 50;

export default async function TracesList({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  // ── Trace-id direct lookup ──────────────────────────────────────────
  // ?tid=<LINE message id> jumps straight to the row's drill-down. Lets
  // operators (and Claude) skip the SQL editor when triaging a specific
  // turn the user reported. No UUID guessing required.
  if (sp.tid && sp.tid.trim()) {
    const row = await getTraceByTraceId(sp.tid.trim());
    if (row) redirect(`/traces/${row.id}`);
    // No match: render the list with a banner. Falls through.
  }

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const traces = await listTraces({
    user: sp.user || undefined,
    path: sp.path,
    q: sp.q || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  return (
    <>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, marginBottom: 16 }}>
        Traces
      </h2>

      {sp.tid && sp.tid.trim() && (
        <div className="admin-error-banner" style={{ marginBottom: 16 }}>
          ไม่พบ trace_id <code>{sp.tid}</code> — ตรวจตัวเลขอีกครั้งหรือ trace อาจถูก auto-prune ไปแล้ว
        </div>
      )}

      {/* Direct lookup by LINE message id (trace_id). Submits to ?tid=…
          which the page handler turns into a redirect to /traces/<row-id>. */}
      <form
        method="get"
        className="admin-filters"
        style={{ marginBottom: 8 }}
      >
        <input
          name="tid"
          placeholder="trace_id (LINE message id, e.g. 613205…)"
          defaultValue={sp.tid ?? ""}
          style={{ minWidth: 360, fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}
        />
        <button type="submit">Open trace</button>
      </form>

      <form method="get" className="admin-filters">
        <input
          name="user"
          placeholder="LINE userId (Uxxx…)"
          defaultValue={sp.user ?? ""}
          style={{ minWidth: 260 }}
        />
        <select name="path" defaultValue={sp.path ?? ""}>
          <option value="">All paths</option>
          <option value="ai">ai</option>
          <option value="memory">memory</option>
          <option value="list">list</option>
          <option value="dashboard">dashboard</option>
          <option value="regex">regex</option>
          <option value="error">error</option>
        </select>
        <input
          name="q"
          placeholder="Search user text…"
          defaultValue={sp.q ?? ""}
          style={{ minWidth: 200 }}
        />
        <button type="submit">Filter</button>
      </form>

      {traces.length === 0 ? (
        <div className="admin-empty">ไม่พบ trace ตาม filter นี้</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Path</th>
              <th>User</th>
              <th>Text</th>
              <th>Iter</th>
              <th>Tools</th>
              <th>Tokens</th>
              <th>Latency</th>
            </tr>
          </thead>
          <tbody>
            {traces.map((t) => {
              const meta = (t.meta as { tokens_in?: number; tokens_out?: number; latency_ms?: number }) ?? {};
              const tokenSum = (meta.tokens_in ?? 0) + (meta.tokens_out ?? 0);
              return (
                <tr key={t.id}>
                  <td>{formatRelative(t.created_at)}</td>
                  <td><TracePathPill path={t.path} /></td>
                  <td title={t.line_user_id ?? ""} style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11 }}>
                    {(t.line_user_id ?? "—").slice(0, 10)}
                  </td>
                  <td>
                    <Link href={`/traces/${t.id}`} style={{ color: "var(--fg)" }}>
                      {truncate(t.user_text, 80)}
                    </Link>
                  </td>
                  <td>{t.ai_iterations || "—"}</td>
                  <td>
                    {Array.isArray(t.tool_calls) ? (t.tool_calls as unknown[]).length : 0}
                  </td>
                  <td>{tokenSum > 0 ? tokenSum : "—"}</td>
                  <td>{meta.latency_ms ? `${meta.latency_ms}ms` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 8, fontSize: 13 }}>
        {page > 1 && (
          <Link href={buildQuery(sp, page - 1)}>← Prev</Link>
        )}
        <span style={{ color: "var(--muted)" }}>Page {page}</span>
        {traces.length === PAGE_SIZE && (
          <Link href={buildQuery(sp, page + 1)}>Next →</Link>
        )}
      </div>
    </>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

function buildQuery(sp: SearchParams, page: number): string {
  const params = new URLSearchParams();
  if (sp.user) params.set("user", sp.user);
  if (sp.path) params.set("path", sp.path);
  if (sp.q) params.set("q", sp.q);
  params.set("page", String(page));
  return `/traces?${params.toString()}`;
}
