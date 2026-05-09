import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminProfile } from "@/lib/admin/auth";
import { MascotMark } from "@/components/MascotMark";
import { SketchyFilter } from "../[locale]/dashboard/SketchyFilter";
import "./admin.css";

export const metadata = {
  title: "LungNote Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getAdminProfile();

  if (!profile) {
    // No session, or session not in admin allowlist → kick to LIFF/auth-line
    // login flow. Return path comes back to admin home.
    redirect("/auth/line/error?code=admin_required");
  }

  return (
    <div className="lungnote-admin">
      <SketchyFilter />
      <header className="admin-header">
        <Link href="/" className="admin-header-brand" style={{ textDecoration: "none" }}>
          <span style={{ color: "var(--fg)" }}>
            <MascotMark size={28} />
          </span>
          <span>
            Lung<span className="accent">Note</span> Admin
          </span>
        </Link>
        <nav className="admin-header-actions">
          <Link href="/" className="admin-header-link">Summary</Link>
          <Link href="/traces" className="admin-header-link">Traces</Link>
          <span title={profile.lineUserId}>
            {profile.displayName ?? profile.lineUserId.slice(0, 8)}
          </span>
        </nav>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
