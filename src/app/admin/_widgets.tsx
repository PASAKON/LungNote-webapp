import type { TraceRow } from "@/lib/admin/traces";

export function TracePathPill({ path }: { path: TraceRow["path"] }) {
  return <span className={`path-pill ${path}`}>{path}</span>;
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
