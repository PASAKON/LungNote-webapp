import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SketchyFilter } from "./SketchyFilter";
import { Topbar } from "./Topbar";
import { BottomTabs } from "./BottomTabs";
import { Sidebar } from "./Sidebar";
import { PullToRefresh } from "./PullToRefresh";
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

  // 4 queries in parallel — RLS scopes them to user; cuts ~3 round-trips
  // (sin1↔BKK ≈ 30 ms each) off first paint.
  const [profileRes, notesCountRes, todoOpenCountRes, notesRes] =
    await Promise.all([
      supabase
        .from("lungnote_profiles")
        .select("line_display_name, line_picture_url")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("lungnote_notes")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("lungnote_todos")
        .select("*", { count: "exact", head: true })
        .eq("done", false),
      supabase
        .from("lungnote_notes")
        .select("id, title, body, updated_at")
        .order("updated_at", { ascending: false })
        .limit(20),
    ]);

  const profile = profileRes.data;
  const notesCount = notesCountRes.count;
  const todoOpenCount = todoOpenCountRes.count;
  const notes = notesRes.data;

  const displayName = profile?.line_display_name ?? "ผู้ใช้ LINE";
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";
  const today = new Date().toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="lungnote-dashboard">
      <SketchyFilter />
      <div className="dash-shell">
        <Sidebar
          active="home"
          notesCount={notesCount ?? undefined}
          todoCount={todoOpenCount ?? undefined}
        />
        <main className="dash-main">
          <Topbar
            pictureUrl={profile?.line_picture_url ?? null}
            initial={initial}
            locale={locale}
          />

          <PullToRefresh>
          <div className="dash-body">
        <div className="greeting">
          <h2>
            สวัสดี, <span className="highlight-tape">{displayName}</span>
          </h2>
          <p>{today}</p>
        </div>

        <div className="stats-row">
          <div className="sketch-box stat-mini">
            <div className="stat-mini-val mint">{notesCount ?? 0}</div>
            <div className="stat-mini-label">โน้ต</div>
          </div>
          <div className="sketch-box stat-mini">
            <div className="stat-mini-val orange">{todoOpenCount ?? 0}</div>
            <div className="stat-mini-label">Todo เหลือ</div>
          </div>
          <div className="sketch-box stat-mini">
            <div className="stat-mini-val ink">0</div>
            <div className="stat-mini-label">วัน Streak</div>
          </div>
        </div>

        <div className="section-h">
          <h3>โน้ตล่าสุด</h3>
          <Link href="/dashboard/notes/new">+ ใหม่</Link>
        </div>

        {!notes || notes.length === 0 ? (
          <div className="empty-block">
            <div className="empty-illustration">
              <div className="empty-notebook" />
              <div className="empty-plus">+</div>
            </div>
            <div className="empty-title">ยังไม่มีโน้ต</div>
            <p className="empty-desc">
              สร้างโน้ตเล่มแรกของคุณ แล้วเริ่มจดสิ่งที่สำคัญ
            </p>
            <p style={{ marginTop: 16 }}>
              <Link href="/dashboard/notes/new" className="btn-main primary">
                สร้างโน้ตแรก
              </Link>
            </p>
          </div>
        ) : (
          <div className="recent-section">
            <div className="recent-list">
              {notes.map((n) => (
                <Link
                  key={n.id}
                  href={`/dashboard/notes/${n.id}`}
                  className="note-row"
                >
                  <span className="note-dot" />
                  <div className="note-info">
                    <div className="note-title">{n.title}</div>
                    <div className="note-meta">
                      {formatRelative(n.updated_at)}
                    </div>
                  </div>
                  <span className="note-arrow">›</span>
                </Link>
              ))}
            </div>
          </div>
        )}
          </div>
          </PullToRefresh>
        </main>
      </div>
      <BottomTabs
        active="home"
        notesCount={notesCount ?? undefined}
        todoCount={todoOpenCount ?? undefined}
      />
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
