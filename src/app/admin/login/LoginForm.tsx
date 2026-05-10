"use client";
import { useActionState, useState } from "react";
import { adminLogin, type LoginState } from "./actions";

const initial: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(adminLogin, initial);
  const [showPw, setShowPw] = useState(false);

  return (
    <form action={formAction} style={{ display: "grid", gap: 14 }}>
      {state.error && (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            borderRadius: 6,
            background: "var(--red-light, #f0d8d0)",
            color: "var(--red, #c45a3a)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {state.error}
        </div>
      )}

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
          Email
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          disabled={pending}
          style={inputStyle}
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
          Password
        </span>
        <div style={{ position: "relative" }}>
          <input
            type={showPw ? "text" : "password"}
            name="password"
            required
            autoComplete="current-password"
            disabled={pending}
            style={{ ...inputStyle, paddingRight: 70 }}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            tabIndex={-1}
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              background: "transparent",
              border: "none",
              color: "var(--muted)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            {showPw ? "ซ่อน" : "แสดง"}
          </button>
        </div>
      </label>

      <button
        type="submit"
        disabled={pending}
        style={{
          padding: "12px 16px",
          borderRadius: 8,
          border: "2px solid var(--accent)",
          background: pending ? "var(--accent-light)" : "var(--accent)",
          color: pending ? "var(--accent)" : "#fff",
          fontFamily: "var(--font-body)",
          fontWeight: 700,
          fontSize: 15,
          cursor: pending ? "wait" : "pointer",
          marginTop: 4,
        }}
      >
        {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: "2px solid var(--border)",
  background: "var(--bg)",
  color: "var(--fg)",
  fontSize: 14,
  fontFamily: "var(--font-body)",
};
