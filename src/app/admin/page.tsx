import Link from "next/link";
import { getAdminSummary } from "@/lib/admin/traces";
import { TracePathPill, formatRelative } from "./_widgets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminHome() {
  const summary = await getAdminSummary();

  return (
    <>
      <div className="admin-stat-grid">
        <StatCard label="Turns 24h" value={summary.total24h} />
        <StatCard
          label="Unique users 24h"
          value={summary.uniqueUsers24h}
        />
        <StatCard
          label="AI cost 24h"
          value={`$${summary.totalCostUsd24h.toFixed(4)}`}
          sub={`${(summary.byPath.find((p) => p.path === "ai")?.count ?? 0)} AI turns`}
        />
        <StatCard
          label="Errors 24h"
          value={summary.errors24h}
          tone={summary.errors24h > 0 ? "danger" : undefined}
        />
      </div>

      <section className="admin-section">
        <h2>By path</h2>
        {summary.byPath.length === 0 ? (
          <div className="admin-empty">ไม่มี traffic 24 ชม. ที่ผ่านมา</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Path</th>
                <th>Count</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {summary.byPath.map(({ path, count }) => (
                <tr key={path}>
                  <td><TracePathPill path={path} /></td>
                  <td>{count}</td>
                  <td>{summary.total24h > 0 ? `${Math.round((count / summary.total24h) * 100)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-section">
        <h2>Recent errors</h2>
        {summary.recentErrors.length === 0 ? (
          <div className="admin-empty">ไม่มี error 24 ชม. 🎉</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Text</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {summary.recentErrors.map((e) => (
                <tr key={e.id}>
                  <td>{formatRelative(e.created_at)}</td>
                  <td title={e.line_user_id ?? ""}>{(e.line_user_id ?? "—").slice(0, 10)}</td>
                  <td>
                    <Link href={`/traces/${e.id}`}>{truncate(e.user_text, 60)}</Link>
                  </td>
                  <td style={{ color: "var(--red)" }}>{truncate(e.error_text ?? "", 80)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function StatCard({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "danger" }) {
  return (
    <div className="admin-stat-card">
      <div className="admin-stat-label">{label}</div>
      <div
        className="admin-stat-value"
        style={tone === "danger" ? { color: "var(--red)" } : undefined}
      >
        {value}
      </div>
      {sub && <div className="admin-stat-sub">{sub}</div>}
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
