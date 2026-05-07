"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LiffSketchyFilter } from "./LiffSketchyFilter";
import "./liff.css";

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
          setState({ status: "error", error: "ไม่ได้รับ id_token จาก LINE" });
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

  if (state.status === "ok") return <SuccessView />;
  if (state.status === "error") return <ErrorView message={state.error ?? "unknown"} />;
  return (
    <ConnectingView
      label={
        state.status === "verifying" ? "กำลังตรวจสอบ..." : "กำลังเชื่อม LINE..."
      }
    />
  );
}

function Logo() {
  return (
    <div className="liff-logo">
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <rect
          x={6}
          y={6}
          width={36}
          height={36}
          rx={4}
          stroke="#2c2a25"
          strokeWidth={3}
          fill="none"
        />
        <path
          d="M14 24 L21 31 L34 16"
          stroke="#2c2a25"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

function ConnectingView({ label }: { label: string }) {
  return (
    <main className="liff-state">
      <LiffSketchyFilter />
      <Logo />
      <div className="liff-title">
        Lung<span>Note</span>
      </div>
      <div className="liff-spinner-wrap">
        <div className="liff-spinner" />
      </div>
      <div className="liff-spinner-text">{label}</div>
      <p className="liff-subtitle">
        กรุณารอสักครู่ ระบบกำลังเชื่อมต่อบัญชี LINE ของคุณ
      </p>
    </main>
  );
}

function SuccessView() {
  return (
    <main className="liff-state">
      <LiffSketchyFilter />
      <div className="liff-success-icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="liff-success-msg">เชื่อมต่อสำเร็จ!</div>
      <p className="liff-subtitle">
        บัญชี LINE ของคุณเชื่อมต่อกับ LungNote แล้ว กำลังเปิด Dashboard...
      </p>
    </main>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <main className="liff-state">
      <LiffSketchyFilter />
      <div className="liff-error-icon">
        <span>!</span>
      </div>
      <div className="liff-error-msg">เชื่อมต่อไม่สำเร็จ</div>
      <p className="liff-error-detail">{message}</p>
      <button
        type="button"
        className="liff-btn"
        onClick={() => window.location.reload()}
      >
        ลองใหม่
      </button>
    </main>
  );
}
