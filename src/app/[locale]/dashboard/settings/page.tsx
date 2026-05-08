import { createClient } from "@/lib/supabase/server";
import { SketchyFilter } from "../SketchyFilter";
import { Topbar } from "../Topbar";
import { BottomTabs } from "../BottomTabs";
import { Sidebar } from "../Sidebar";
import { signOut } from "../actions";
import "../dashboard.css";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: PageProps<"/[locale]/dashboard/settings">) {
  const { locale } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, notesCountRes, todoOpenCountRes] = await Promise.all([
    supabase
      .from("lungnote_profiles")
      .select("line_display_name, line_picture_url, line_user_id, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("lungnote_notes")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("lungnote_todos")
      .select("*", { count: "exact", head: true })
      .eq("done", false),
  ]);

  const profile = profileRes.data;
  const notesCount = notesCountRes.count;
  const todoOpenCount = todoOpenCountRes.count;

  const displayName = profile?.line_display_name ?? "ผู้ใช้ LINE";
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";
  const joined = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="lungnote-dashboard">
      <SketchyFilter />
      <div className="dash-shell">
        <Sidebar
          active="settings"
          notesCount={notesCount ?? undefined}
          todoCount={todoOpenCount ?? undefined}
        />
        <main className="dash-main">
          <Topbar
            pictureUrl={profile?.line_picture_url ?? null}
            initial={initial}
            locale={locale}
          />
          <div className="dash-body">
            <div style={{ padding: "20px" }}>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 32,
                  fontWeight: 700,
                  marginBottom: 24,
                }}
              >
                ตั้งค่า
              </h1>

              <section
                className="sketch-box"
                style={{ padding: 20, marginBottom: 16 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    marginBottom: 14,
                  }}
                >
                  {profile?.line_picture_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.line_picture_url}
                      alt={displayName}
                      width={56}
                      height={56}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        border: "2px solid var(--fg)",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        border: "2px solid var(--fg)",
                        background: "var(--accent-light)",
                        color: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--font-display)",
                        fontSize: 28,
                        fontWeight: 700,
                      }}
                    >
                      {initial}
                    </div>
                  )}
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 24,
                        fontWeight: 700,
                      }}
                    >
                      {displayName}
                    </div>
                    {joined && (
                      <div style={{ fontSize: 13, color: "var(--muted)" }}>
                        สมาชิกตั้งแต่ {joined}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  LINE userId:{" "}
                  <code
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      background: "var(--bg)",
                      padding: "2px 6px",
                      borderRadius: 3,
                    }}
                  >
                    {profile?.line_user_id}
                  </code>
                </div>
              </section>

              <section
                className="sketch-box"
                style={{
                  padding: 20,
                  marginBottom: 16,
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 16,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 28,
                      fontWeight: 700,
                      color: "var(--accent)",
                    }}
                  >
                    {notesCount ?? 0}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    โน้ตทั้งหมด
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 28,
                      fontWeight: 700,
                      color: "var(--orange)",
                    }}
                  >
                    {todoOpenCount ?? 0}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    Todo ที่ค้าง
                  </div>
                </div>
              </section>

              <form action={signOut}>
                <button
                  type="submit"
                  className="btn-main danger"
                  style={{ width: "100%" }}
                >
                  ออกจากระบบ
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
      <BottomTabs
        active="settings"
        notesCount={notesCount ?? undefined}
        todoCount={todoOpenCount ?? undefined}
      />
    </div>
  );
}
