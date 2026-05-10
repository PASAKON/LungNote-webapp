import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrace } from "@/lib/admin/traces";
import { TracePathPill, formatRelative } from "../../_widgets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TraceDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTrace(id);
  if (!t) notFound();

  const meta = (t.meta as Record<string, unknown> | null) ?? {};
  const toolCalls = Array.isArray(t.tool_calls)
    ? (t.tool_calls as Array<{ name: string; args: unknown; result: unknown }>)
    : [];

  return (
    <>
      <Link href="/traces" style={{ fontSize: 13, color: "var(--muted)" }}>
        ← back to traces
      </Link>

      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, margin: "12px 0 16px" }}>
        Trace {t.trace_id}
      </h2>

      {t.error_text && (
        <div className="admin-error-banner">
          <strong>Error:</strong> {t.error_text}
        </div>
      )}

      <section className="trace-detail">
        <h3>Summary</h3>
        <KV label="When" value={`${formatRelative(t.created_at)} (${new Date(t.created_at).toISOString()})`} />
        <KV label="Path" value={<TracePathPill path={t.path} />} />
        <KV label="LINE user" value={t.line_user_id ?? "—"} mono />
        <KV label="History loaded" value={`${t.history_count} turns`} />
        <KV label="AI iterations" value={String(t.ai_iterations)} />
        <KV label="Tool calls" value={String(toolCalls.length)} />
        {typeof meta.model === "string" && <KV label="Model" value={meta.model} />}
        {typeof meta.tokens_in === "number" && (
          <KV label="Tokens" value={`${meta.tokens_in} in / ${meta.tokens_out} out`} />
        )}
        {typeof meta.cost_usd === "number" && (
          <KV label="Cost" value={`$${(meta.cost_usd as number).toFixed(6)}`} />
        )}
        {typeof meta.latency_ms === "number" && (
          <KV label="Latency" value={`${meta.latency_ms} ms`} />
        )}
      </section>

      <section className="trace-detail">
        <h3>Input</h3>
        <pre>{t.user_text}</pre>
      </section>

      <section className="trace-detail">
        <h3>Reply</h3>
        <pre>{t.reply_text ?? "(no reply text recorded)"}</pre>
      </section>

      {toolCalls.length > 0 && (
        <section className="trace-detail">
          <h3>Tool calls</h3>
          {toolCalls.map((tc, i) => (
            <details key={i} open style={{ marginBottom: 12 }}>
              <summary style={{ cursor: "pointer", fontFamily: "var(--font-mono, monospace)", fontSize: 13, color: "var(--accent)" }}>
                #{i + 1} {tc.name}
              </summary>
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>args</div>
                <pre>{JSON.stringify(tc.args, null, 2)}</pre>
                <div style={{ fontSize: 11, color: "var(--muted)", margin: "8px 0 4px" }}>result</div>
                <pre>{JSON.stringify(tc.result, null, 2)}</pre>
              </div>
            </details>
          ))}
        </section>
      )}

      <section className="trace-detail">
        <h3>Raw meta</h3>
        <pre>{JSON.stringify(meta, null, 2)}</pre>
      </section>
    </>
  );
}

function KV({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "4px 0", fontSize: 13 }}>
      <div style={{ width: 140, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontFamily: mono ? "var(--font-mono, monospace)" : undefined }}>
        {value}
      </div>
    </div>
  );
}
