import { LoginForm } from "./LoginForm";
import { getAdminProfile } from "@/lib/admin/auth";
import { redirect } from "next/navigation";
import "../admin.css";
import "./login.css";

export const metadata = {
  title: "Login · LungNote Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  // Already authenticated → bounce to home.
  const profile = await getAdminProfile();
  if (profile) redirect("/");

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
        <LoginForm />
      </div>
    </div>
  );
}
