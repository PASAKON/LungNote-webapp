"use client";
import { useActionState, useState } from "react";
import { adminLogin, type LoginState } from "./actions";

const initial: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(adminLogin, initial);
  const [showPw, setShowPw] = useState(false);

  return (
    <form action={formAction} className="login-form">
      {state.error && (
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

      <div className="login-field">
        <label className="login-label" htmlFor="password">
          Password
        </label>
        <div className="login-input-wrap">
          <input
            id="password"
            className="login-input"
            type={showPw ? "text" : "password"}
            name="password"
            required
            autoComplete="current-password"
            disabled={pending}
            placeholder="Enter password"
          />
          <button
            type="button"
            className="login-input-toggle"
            onClick={() => setShowPw((v) => !v)}
            tabIndex={-1}
          >
            {showPw ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <button type="submit" className="login-submit" disabled={pending}>
        {pending ? (
          <>
            <span className="login-spinner" aria-hidden="true" />
            <span>Signing in…</span>
          </>
        ) : (
          <span>Sign in</span>
        )}
      </button>
    </form>
  );
}
