import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminProfile } from "@/lib/admin/auth";
import { adminLogout } from "../login/actions";
import { MascotMark } from "@/components/MascotMark";
import { SketchyFilter } from "../../[locale]/dashboard/SketchyFilter";
import "../admin.css";

/**
 * Auth gate for everything under app/admin/(protected)/*.
 * Login page lives at /admin/login outside this group so it can render
 * without bouncing.
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getAdminProfile();
  if (!profile) redirect("/login");

  return (
    <div className="lungnote-admin">
      <SketchyFilter />
      <header className="admin-header">
        <Link
          href="/"
          className="admin-header-brand"
          style={{ textDecoration: "none" }}
        >
          <span style={{ color: "var(--fg)" }}>
            <MascotMark size={28} />
          </span>
          <span>
            Lung<span className="accent">Note</span> Admin
          </span>
        </Link>
        <nav className="admin-header-actions">
          <Link href="/" className="admin-header-link">
            Summary
          </Link>
          <Link href="/traces" className="admin-header-link">
            Traces
          </Link>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>
            {profile.email}
          </span>
          <form action={adminLogout}>
            <button
              type="submit"
              className="admin-header-link"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                font: "inherit",
              }}
            >
              Logout
            </button>
          </form>
        </nav>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
