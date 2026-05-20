"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  connection:
    | {
        email: string;
        status: string;
        last_synced_at: string | null;
      }
    | null;
};

const STATUS_LABEL: Record<string, string> = {
  active: "เชื่อมต่อแล้ว",
  revoked: "ถูกยกเลิก",
  error: "เกิดข้อผิดพลาด",
  expired: "หมดอายุ",
};

type ScopeTier = "read" | "edit" | "full";

const SCOPE_OPTIONS: Array<{
  value: ScopeTier;
  label: string;
  detail: string;
}> = [
  {
    value: "read",
    label: "อ่านอย่างเดียว",
    detail: "AI อ่านเมลเพื่อแยก to-do เท่านั้น",
  },
  {
    value: "edit",
    label: "อ่าน + แก้ไข",
    detail: "อ่าน + ติด label + ร่าง reply + archive (ไม่ลบ)",
  },
  {
    value: "full",
    label: "ทุกสิทธิ์",
    detail: "รวมลบเมลถาวร — ระวัง",
  },
];

function ConnectForm() {
  const [tier, setTier] = useState<ScopeTier>("read");
  const selected = SCOPE_OPTIONS.find((o) => o.value === tier) ?? SCOPE_OPTIONS[0];
  return (
    <div>
      <div
        style={{
          fontSize: 13,
          color: "var(--muted)",
          marginBottom: 10,
        }}
      >
        ให้ AI ดึง to-do ด่วน และเมลที่ต้องตอบกลับจาก Gmail
        เข้ามาใส่ใน Inbox อัตโนมัติ
      </div>
      <label
        style={{
          display: "block",
          fontSize: 12,
          color: "var(--muted)",
          marginBottom: 4,
        }}
      >
        ระดับสิทธิ์
      </label>
      <select
        value={tier}
        onChange={(e) => setTier(e.target.value as ScopeTier)}
        style={{
          width: "100%",
          padding: "8px 10px",
          marginBottom: 6,
          background: "var(--bg)",
          color: "var(--fg)",
          border: "2px solid var(--fg)",
          borderRadius: 6,
          fontSize: 14,
        }}
      >
        {SCOPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <div
        style={{
          fontSize: 12,
          color: "var(--muted)",
          marginBottom: 14,
        }}
      >
        {selected.detail}
      </div>
      <a
        href={`/api/auth/gmail/connect?tier=${tier}`}
        className="btn-main"
        style={{
          display: "inline-block",
          textDecoration: "none",
        }}
      >
        เชื่อมต่อ Gmail
      </a>
    </div>
  );
}

export function GmailConnectionCard({ connection }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleDisconnect() {
    if (busy) return;
    if (!confirm("ยกเลิกการเชื่อมต่อ Gmail? Todo ที่ดึงมาแล้วจะยังอยู่")) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/gmail/disconnect", {
        method: "DELETE",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      startTransition(() => router.refresh());
    } catch (err) {
      alert(
        "ยกเลิกไม่สำเร็จ: " +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!connection) {
    return <ConnectForm />;
  }

  const synced = connection.last_synced_at
    ? new Date(connection.last_synced_at).toLocaleString("th-TH", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "ยังไม่ได้สแกน";

  return (
    <div>
      <div style={{ fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: "var(--muted)" }}>บัญชี: </span>
        <code
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            background: "var(--bg)",
            padding: "2px 6px",
            borderRadius: 3,
          }}
        >
          {connection.email}
        </code>
      </div>
      <div style={{ fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: "var(--muted)" }}>สถานะ: </span>
        {STATUS_LABEL[connection.status] ?? connection.status}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--muted)",
          marginBottom: 14,
        }}
      >
        สแกนล่าสุด: {synced}
      </div>
      <button
        type="button"
        className="btn-main danger"
        onClick={handleDisconnect}
        disabled={busy || pending}
        style={{ width: "100%" }}
      >
        {busy || pending ? "กำลังยกเลิก…" : "ยกเลิกการเชื่อมต่อ"}
      </button>
    </div>
  );
}
