"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Status = "init" | "verifying" | "ok" | "error";

export function LiffClient() {
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;

  if (!liffId) {
    return (
      <ErrorView message="LIFF ยังไม่ได้ตั้งค่า (NEXT_PUBLIC_LINE_LIFF_ID)" />
    );
  }
  return <LiffInner liffId={liffId} />;
}

function LiffInner({ liffId }: { liffId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const [state, setState] = useState<{ status: Status; error?: string }>({
    status: "init",
  });
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    void (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });
        if (cancelled) return;

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const idToken = liff.getIDToken();
        if (!idToken) {
          setState({
            status: "error",
            error: "ไม่ได้รับ id_token จาก LINE",
          });
          return;
        }

        setState({ status: "verifying" });
        const res = await fetch("/api/auth/liff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) {
          const detail = await res.text();
          setState({
            status: "error",
            error: `auth ล้มเหลว (${res.status}) ${detail}`,
          });
          return;
        }

        if (cancelled) return;
        setState({ status: "ok" });
        const next = search.get("next") || "/dashboard";
        router.replace(next);
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "error",
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [liffId, router, search]);

  if (state.status === "error") return <ErrorView message={state.error ?? "unknown"} />;

  const labels: Record<Exclude<Status, "error">, string> = {
    init: "กำลังเชื่อม LINE...",
    verifying: "กำลังตรวจสอบ...",
    ok: "เปิด Dashboard...",
  };
  return <SpinnerView label={labels[state.status]} />;
}

function SpinnerView({ label }: { label: string }) {
  return (
    <main style={SHELL}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "3px solid #e0ddd4",
          borderTopColor: "#6aab8e",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <p style={{ fontSize: 16, color: "#8a8578" }}>{label}</p>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </main>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <main style={SHELL}>
      <div style={{ fontSize: 40 }}>⚠️</div>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>เปิด Dashboard ไม่ได้</h1>
      <p style={{ fontSize: 14, color: "#8a8578", maxWidth: 360 }}>{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          marginTop: 16,
          fontSize: 14,
          padding: "10px 20px",
          border: "1.5px solid #2c2a25",
          borderRadius: 4,
          background: "#fdf6dc",
          cursor: "pointer",
        }}
      >
        ลองอีกครั้ง
      </button>
    </main>
  );
}

const SHELL = {
  minHeight: "100dvh",
  background: "#faf8f4",
  color: "#2c2a25",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
  fontFamily:
    "Sarabun, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  padding: 24,
  textAlign: "center" as const,
};
