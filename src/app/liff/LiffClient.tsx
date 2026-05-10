"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MascotMark } from "@/components/MascotMark";
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

  // Debug breadcrumb posted to /api/debug/liff — server logs each step
  // as a single JSON line so we can trace what happens after a rich-
  // menu tap. Best-effort; failure never blocks the flow.
  const traceId = useRef<string | null>(null);
  if (traceId.current === null) {
    // Lazy init — assigned once on first render. Date.now + Math.random
    // are technically impure, but inside a useRef-guarded init they
    // run exactly once per mount — safe per the React useRef pattern.
    // eslint-disable-next-line react-hooks/purity
    traceId.current = `liff-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }
  const debug = (step: string, data: Record<string, unknown> = {}) => {
    try {
      const body = JSON.stringify({
        step,
        data: { trace: traceId.current, ...data },
      });
      // sendBeacon survives navigation; fall back to fetch if blocked.
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/debug/liff", blob);
      } else {
        void fetch("/api/debug/liff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    void (async () => {
      try {
        debug("page_load", {
          href: typeof window !== "undefined" ? window.location.href : "",
          next: search.get("next"),
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 120) : "",
        });

        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });
        if (cancelled) return;

        debug("liff_init_ok", {
          isInClient: typeof liff.isInClient === "function" ? liff.isInClient() : null,
          isLoggedIn: liff.isLoggedIn(),
          os: typeof liff.getOS === "function" ? liff.getOS() : null,
          version: typeof liff.getVersion === "function" ? liff.getVersion() : null,
        });

        if (!liff.isLoggedIn()) {
          debug("liff_login_redirect", {
            redirectUri: window.location.href,
          });
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const idToken = liff.getIDToken();
        debug("liff_id_token", { hasToken: !!idToken, length: idToken?.length ?? 0 });
        if (!idToken) {
          setState({ status: "error", error: "ไม่ได้รับ id_token จาก LINE" });
          return;
        }

        setState({ status: "verifying" });
        debug("auth_post_start", {});
        const res = await fetch("/api/auth/liff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        debug("auth_post_done", { status: res.status, ok: res.ok });

        if (!res.ok) {
          const detail = await res.text();
          debug("auth_post_error", { status: res.status, detail: detail.slice(0, 300) });
          setState({
            status: "error",
            error: `auth ล้มเหลว (${res.status}) ${detail}`,
          });
          return;
        }

        if (cancelled) return;
        setState({ status: "ok" });
        const next = search.get("next") || "/dashboard";
        debug("router_replace", { next });
        router.replace(next);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "unknown";
        debug("exception", { msg });
        setState({ status: "error", error: msg });
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
    <div className="liff-logo" style={{ color: "#3a3020" }}>
      <MascotMark size={64} />
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
