import Link from "next/link";
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
    // Render inline gate instead of redirecting — admin subdomain rewrite
    // would mangle a redirect to /auth/* paths. Tell the user how to log in
    // on the public host and come back.
    return <UnauthorizedGate />;
  }

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
          <span title={profile.lineUserId}>
            {profile.displayName ?? profile.lineUserId.slice(0, 8)}
          </span>
        </nav>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}

function UnauthorizedGate() {
  return (
    <div className="lungnote-admin">
      <main
        className="admin-main"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100dvh",
          textAlign: "center",
          gap: 20,
          maxWidth: 480,
        }}
      >
        <div style={{ color: "var(--fg)" }}>
          <MascotMark size={96} />
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 32,
            fontWeight: 700,
          }}
        >
          Admin only
        </h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
          หน้าสำหรับผู้ดูแลระบบ — ต้อง login ด้วย LINE userId ที่อยู่ใน
          allowlist.
        </p>
        <ol
          style={{
            textAlign: "left",
            color: "var(--muted)",
            fontSize: 14,
            lineHeight: 1.8,
            background: "var(--surface)",
            padding: "16px 24px",
            border: "1.5px solid var(--border)",
            borderRadius: 6,
          }}
        >
          <li>เปิด LINE OA ของ LungNote</li>
          <li>พิมพ์ <code>dashboard</code> — bot ส่งลิงก์มา</li>
          <li>คลิกลิงก์ login → cookie จะตั้งบน <code>lungnote.com</code></li>
          <li>กลับมาที่ <code>admin.lungnote.com</code> แล้ว refresh</li>
        </ol>
        <p
          style={{
            color: "var(--muted)",
            fontSize: 12,
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          ถ้ายังไม่ผ่าน — แปลว่า LINE userId ของคุณไม่ใช่ admin allowlist
        </p>
      </main>
    </div>
  );
}
