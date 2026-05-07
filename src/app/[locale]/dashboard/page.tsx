import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "./DashboardHeader";
import "./dashboard.css";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
}: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("lungnote_profiles")
    .select("line_display_name, line_picture_url")
    .eq("id", user.id)
    .maybeSingle();

  const { data: notes } = await supabase
    .from("lungnote_notes")
    .select("id, title, body, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="lungnote-dashboard">
      <div className="dash-wrap">
        <DashboardHeader
          displayName={profile?.line_display_name ?? null}
          pictureUrl={profile?.line_picture_url ?? null}
          locale={locale}
        />

        <h1 className="dash-section-title">โน้ตของฉัน</h1>

        {!notes || notes.length === 0 ? (
          <div className="empty-state">
            <h3>ยังไม่มีโน้ต</h3>
            <p>เริ่มต้นด้วยการสร้างเล่มแรกของคุณ</p>
            <p style={{ marginTop: 24 }}>
              <Link href="/dashboard/notes/new" className="btn-primary">
                + สร้างโน้ตใหม่
              </Link>
            </p>
          </div>
        ) : (
          <div className="notes-grid">
            {notes.map((n) => (
              <Link
                key={n.id}
                href={`/dashboard/notes/${n.id}`}
                className="note-card"
              >
                <div className="note-card-title">{n.title}</div>
                <div className="note-card-preview">
                  {n.body || <em>ยังไม่มีเนื้อหา</em>}
                </div>
                <div className="note-card-meta">
                  แก้ไขล่าสุด {formatRelative(n.updated_at)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Link href="/dashboard/notes/new" className="fab-add" aria-label="add">
        +
      </Link>
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "เมื่อสักครู่";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} นาทีก่อน`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ชั่วโมงก่อน`;
  if (diffSec < 86400 * 30)
    return `${Math.floor(diffSec / 86400)} วันก่อน`;
  return new Date(iso).toLocaleDateString("th-TH");
}
