import { LoginForm } from "./LoginForm";
import { getAdminProfile } from "@/lib/admin/auth";
import { redirect } from "next/navigation";
import "../admin.css";
import "./login.css";

export const metadata = {
  title: "Login · LungNote Admin",
  robots: { index: false, follow: false },
};

const ERROR_COPY: Record<string, string> = {
  denied: "Email นี้ไม่ใช่ admin",
  invalid_link: "ลิงก์ไม่ถูกต้องหรือหมดอายุ — ขอลิงก์ใหม่",
  missing_token: "ลิงก์ไม่สมบูรณ์",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Already authenticated → bounce to home.
  const profile = await getAdminProfile();
  if (profile) redirect("/");

  const sp = await searchParams;
  const rawErr = sp?.error;
  const errorKey = Array.isArray(rawErr) ? rawErr[0] : rawErr;
  const initialError =
    typeof errorKey === "string" && errorKey in ERROR_COPY
      ? ERROR_COPY[errorKey]
      : null;

  return (
    <div className="lungnote-admin login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-brand">
            <span className="login-brand-text">LungNote</span>
            <span className="admin-badge">Admin</span>
          </div>
          <p className="login-warning">Internal access only</p>
        </div>
        <LoginForm initialError={initialError} />
      </div>
    </div>
  );
}
