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
        // LINE id_token TTL is short (~30 min). If the user opens the
        // /liff page from a stale tab, `getIDToken()` returns a cached
        // expired token and the server fails with verify_failed_400
        // "IdToken expired." Reject anything within 60s of expiry and
        // force a fresh login round-trip instead.
        const expSecondsAway = idToken ? jwtSecondsUntilExpiry(idToken) : null;
        debug("liff_id_token", {
          hasToken: !!idToken,
          length: idToken?.length ?? 0,
          expSecondsAway,
        });
        if (!idToken) {
          setState({ status: "error", error: "ไม่ได้รับ id_token จาก LINE" });
          return;
        }
        if (expSecondsAway !== null && expSecondsAway < 60) {
          debug("liff_id_token_expired_relogin", { expSecondsAway });
          try {
            liff.logout();
          } catch {
            /* ignore */
          }
          liff.login({ redirectUri: window.location.href });
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

        // verify_failed_400 with "IdToken expired" can still happen
        // if the token was on the edge — LINE's server clock may say
        // expired while ours said valid. One retry via re-login covers
        // that case and avoids stranding the user on an error screen.
        if (res.status === 401) {
          const detail = await res.text();
          if (detail.includes("verify_failed_400")) {
            debug("auth_relogin_on_expired", { detail: detail.slice(0, 200) });
            try {
              liff.logout();
            } catch {
              /* ignore */
            }
            liff.login({ redirectUri: window.location.href });
            return;
          }
          debug("auth_post_error", { status: res.status, detail: detail.slice(0, 300) });
          setState({
            status: "error",
            error: `auth ล้มเหลว (${res.status}) ${detail}`,
          });
          return;
        }

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
        const next = safeNext(search.get("next"));
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

/**
 * Decode a JWT payload (no signature check) and return the number of
 * seconds until the token's `exp` claim. Returns null if the token
 * cannot be parsed or has no `exp`. Negative number means already
 * expired.
 *
 * Lives here (not in a shared lib) because it's only used by the
 * LIFF client to decide whether to force a re-login before submitting
 * the token to /api/auth/liff.
 */
function jwtSecondsUntilExpiry(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // base64url → base64
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== "number") return null;
    return payload.exp - Math.floor(Date.now() / 1000);
  } catch {
    return null;
  }
}

/**
 * Open-redirect guard. `next` must be a same-origin relative path:
 *   "/"  → "/foo/bar"     OK
 *   "//evil.com/..."      reject (protocol-relative URL)
 *   "/\\evil.com/..."     reject (backslash variant)
 *   "https://evil.com"    reject (absolute URL)
 *   anything else         fall back to "/dashboard"
 *
 * Without this guard, an attacker could craft `?next=https://evil.com`
 * and have LIFF auth carry the user out to a phishing page that mimics
 * LungNote/LINE.
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/")) return "/dashboard";
  // Protocol-relative URLs ("//foo.com") and backslash variants
  // ("/\\foo.com") both bypass naive relative-path checks.
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/dashboard";
  return raw;
}

// Inline LungNote mascot — Option D "Float & Dots" animation.
// Path data mirrors design/brand/mascot-loading.html.
function MascotFloat() {
  return (
    <svg
      className="liff-mascot"
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M42 38 Q44 35 52 34 Q100 32 148 34 Q156 35 158 38 Q163 70 163 128 Q158 156 148 162 Q100 164 52 162 Q42 156 38 128 Q38 70 42 38Z" />
      <path
        d="M54 30 Q56 26 64 24 Q100 22 136 24 Q144 26 146 30 Q148 38 146 44 Q136 48 100 48 Q64 46 54 42 Q54 38 54 30Z"
        strokeWidth={2.5}
      />
      <circle cx="74" cy="78" r="12" fill="currentColor" stroke="none" />
      <circle cx="126" cy="76" r="10" fill="currentColor" stroke="none" />
      <path
        d="M76 114 Q84 122 90 128 Q94 126 100 118 Q108 108 126 92"
        strokeWidth={5}
      />
      <path d="M36 82 Q20 72 6 82" />
      <path d="M164 80 Q180 70 194 80" />
      <path d="M62 162 Q68 172 76 178 Q84 172 86 162" />
      <path d="M114 162 Q120 172 128 178 Q136 172 138 162" />
    </svg>
  );
}

// Error mascot — 500-style X-eyes + wavy mouth + lightning.
function MascotError() {
  return (
    <svg
      className="liff-mascot liff-mascot--error"
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M42 38 Q44 35 52 34 Q100 32 148 34 Q156 35 158 38 Q163 70 163 128 Q158 156 148 162 Q100 164 52 162 Q42 156 38 128 Q38 70 42 38Z" />
      <path
        d="M54 30 Q56 26 64 24 Q100 22 136 24 Q144 26 146 30 Q148 38 146 44 Q136 48 100 48 Q64 46 54 42 Q54 38 54 30Z"
        strokeWidth={2.5}
      />
      {/* X eyes */}
      <path d="M64 70 L84 86 M84 70 L64 86" strokeWidth={4} />
      <path d="M116 68 L136 84 M136 68 L116 84" strokeWidth={4} />
      {/* Wavy mouth */}
      <path d="M80 120 Q90 128 100 120 Q110 128 120 120" strokeWidth={4} />
      {/* Lightning bolt above head */}
      <path d="M95 2 L88 18 L100 16 L92 34" strokeWidth={3} />
      <path d="M36 82 Q20 72 6 82" />
      <path d="M164 80 Q180 70 194 80" />
      <path d="M62 162 Q68 172 76 178 Q84 172 86 162" />
      <path d="M114 162 Q120 172 128 178 Q136 172 138 162" />
    </svg>
  );
}

function ConnectingView({ label }: { label: string }) {
  return (
    <main className="liff-state liff-state--connecting">
      <LiffSketchyFilter />
      <div className="liff-mascot-wrap liff-mascot-wrap--float">
        <MascotFloat />
      </div>
      <div className="liff-title">
        Lung<span>Note</span>
      </div>
      <div className="liff-dots" aria-hidden="true">
        <span />
        <span />
        <span />
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
    <main className="liff-state liff-state--error">
      <LiffSketchyFilter />
      <div className="liff-mascot-wrap liff-mascot-wrap--error">
        <MascotError />
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
