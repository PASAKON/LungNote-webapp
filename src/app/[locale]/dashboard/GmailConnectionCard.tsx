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
    return (
      <div>
        <div
          style={{
            fontSize: 13,
            color: "var(--muted)",
            marginBottom: 14,
          }}
        >
          ให้ AI ดึง to-do ด่วน และเมลที่ต้องตอบกลับจาก Gmail
          เข้ามาใส่ใน Inbox อัตโนมัติ
        </div>
        <a
          href="/api/auth/gmail/connect"
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
