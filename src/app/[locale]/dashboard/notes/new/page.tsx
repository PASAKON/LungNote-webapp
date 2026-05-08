import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SketchyFilter } from "../../SketchyFilter";
import { Topbar } from "../../Topbar";
import { BottomTabs } from "../../BottomTabs";
import { NoteForm } from "../../NoteForm";
import { createNote } from "../../actions";
import "../../dashboard.css";

export const dynamic = "force-dynamic";

export default async function NewNotePage({
  params,
}: PageProps<"/[locale]/dashboard/notes/new">) {
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

  const displayName = profile?.line_display_name ?? "ผู้ใช้ LINE";
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="lungnote-dashboard">
      <SketchyFilter />
      <Topbar
        pictureUrl={profile?.line_picture_url ?? null}
        initial={initial}
        locale={locale}
      />
      <div className="dash-body">
        <div className="note-form-wrap">
          <Link href="/dashboard" className="note-form-back">
            ← กลับ
          </Link>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 28,
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            สร้างโน้ตใหม่
          </h1>
          <NoteForm
            submitLabel="บันทึก"
            cancelHref="/dashboard"
            onSubmit={createNote}
          />
        </div>
      </div>
      <BottomTabs active="home" />
    </div>
  );
}
