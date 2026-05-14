import type { TraceRow } from "@/lib/admin/traces";

export function TracePathPill({ path }: { path: TraceRow["path"] }) {
  return <span className={`path-pill ${path}`}>{path}</span>;
}

/**
 * Visual indicator of the intent router's decision for an AI turn.
 *
 *  - gray   "router_disabled" — the feature flag is off; model came
 *           from `LLM_MODEL` env.
 *  - subtle "default"         — router on but no escalation trigger
 *                               matched → stayed on the cheap fast
 *                               model.
 *  - accent any escalation    — router routed this turn to the complex
 *                               model. Tag = which trigger fired
 *                               (update_verb, profile_fact, ...).
 */
export function RoutePill({ reason }: { reason: string }) {
  const isEscalation = reason !== "default" && reason !== "router_disabled";
  const bg = isEscalation
    ? "var(--accent-light, #f0e4c4)"
    : reason === "default"
      ? "var(--surface, #f5ead4)"
      : "var(--border, #e0d0a0)";
  const color = isEscalation
    ? "var(--accent, #c9a040)"
    : "var(--muted, #a08050)";
  return (
    <span
      title={
        isEscalation
          ? `router escalated this turn — trigger: ${reason}`
          : reason === "default"
            ? "router on, no escalation trigger matched — used fast model"
            : "router disabled — used LLM_MODEL env directly"
      }
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: 4,
        background: bg,
        color,
        fontFamily: "var(--font-mono, monospace)",
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        verticalAlign: "middle",
      }}
    >
      {reason}
    </span>
  );
}

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 60) return "เมื่อสักครู่";
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีก่อน`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชม.ก่อน`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} วันก่อน`;
  return new Date(iso).toLocaleDateString("th-TH");
}
