import { LoginForm } from "./LoginForm";
import { getAdminProfile } from "@/lib/admin/auth";
import { redirect } from "next/navigation";
import "../admin.css";

export const metadata = {
  title: "Login · LungNote Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  // Already authenticated → bounce to home.
  const profile = await getAdminProfile();
  if (profile) redirect("/");

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--surface)",
          border: "2px solid var(--border)",
          borderRadius: 12,
          padding: "32px 28px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 24,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 24,
              fontWeight: 700,
              color: "var(--fg)",
            }}
          >
            LungNote
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              color: "var(--accent)",
              background: "var(--accent-light)",
              padding: "3px 8px",
              borderRadius: 4,
            }}
          >
            ADMIN
          </span>
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 700,
            margin: "0 0 6px",
            color: "var(--fg)",
          }}
        >
          เข้าสู่ระบบ
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--muted)",
            margin: "0 0 24px",
          }}
        >
          Internal access only. ใช้ email + password ที่ Supabase ตั้งไว้.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
