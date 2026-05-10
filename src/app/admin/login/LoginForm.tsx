"use client";
import { useActionState } from "react";
import { adminLogin } from "./actions";
import { LOGIN_INITIAL, type LoginState } from "./state";

export function LoginForm({ initialError }: { initialError?: string | null }) {
  const seed: LoginState = initialError
    ? { status: "error", error: initialError }
    : LOGIN_INITIAL;
  const [state, formAction, pending] = useActionState(adminLogin, seed);

  if (state.status === "sent") {
    return (
      <div className="login-sent">
        <div className="login-sent-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <h2 className="login-sent-title">ส่งลิงก์แล้ว</h2>
        <p className="login-sent-desc">
          เช็ค inbox — กดลิงก์ในเมลเพื่อ login ทันที.
          <br />
          ลิงก์หมดอายุภายใน 1 ชั่วโมง.
        </p>
        <p className="login-sent-hint">
          ไม่ได้รับ? เช็คโฟลเดอร์ spam หรือ{" "}
          <button
            type="button"
            className="login-sent-link"
            onClick={() => window.location.reload()}
          >
            ลองอีกครั้ง
          </button>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="login-form">
      {state.status === "error" && state.error && (
        <div role="alert" className="login-error-banner">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span>{state.error}</span>
        </div>
      )}

      <div className="login-field">
        <label className="login-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="login-input"
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          disabled={pending}
          placeholder="admin@lungnote.app"
        />
      </div>

      <button type="submit" className="login-submit" disabled={pending}>
        {pending ? (
          <>
            <span className="login-spinner" aria-hidden="true" />
            <span>กำลังส่งลิงก์…</span>
          </>
        ) : (
          <span>ส่งลิงก์ไปยัง email</span>
        )}
      </button>

      <p className="login-helper">
        ระบบจะส่ง one-time link เข้า email ที่อยู่ใน allowlist เท่านั้น.
      </p>
    </form>
  );
}
