import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminProfile } from "@/lib/admin/auth";
import { adminLogout } from "../login/actions";
import "../admin.css";

/**
 * Auth gate + shell for everything under app/admin/(protected)/*.
 * Layout follows design/admin/admin-shell.html: 240px sidebar + 56px
 * topbar, max-width 1200px main. Mobile collapses sidebar.
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getAdminProfile();
  if (!profile) redirect("/login");

  return (
    <div className="lungnote-admin admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <Link href="/" className="admin-topbar-brand">
            <span>LungNote</span>
            <span className="admin-badge">Admin</span>
          </Link>
        </div>
        <div className="admin-topbar-right">
          <span className="admin-topbar-user">{profile.email}</span>
          <form action={adminLogout}>
            <button type="submit" className="admin-btn-outline">
              Logout
            </button>
          </form>
        </div>
      </header>

      <aside className="admin-sidebar">
        <div className="admin-nav-section">Navigation</div>
        <Link href="/" className="admin-nav-item">
          Summary
        </Link>
        <Link href="/traces" className="admin-nav-item">
          Traces
        </Link>
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  );
}
