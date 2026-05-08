import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SketchyFilter } from "../../SketchyFilter";
import { Topbar } from "../../Topbar";
import { BottomTabs } from "../../BottomTabs";
import { NoteForm } from "../../NoteForm";
import { updateNote, deleteNote } from "../../actions";
import "../../dashboard.css";

export const dynamic = "force-dynamic";

export default async function EditNotePage({
  params,
}: PageProps<"/[locale]/dashboard/notes/[id]">) {
  const { locale, id } = await params;
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

  const { data: note } = await supabase
    .from("lungnote_notes")
    .select("id, title, body")
    .eq("id", id)
    .maybeSingle();

  if (!note) notFound();

  const displayName = profile?.line_display_name ?? "ผู้ใช้ LINE";
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  const updateAction = async (formData: FormData) => {
    "use server";
    return updateNote(note.id, formData);
  };

  const deleteAction = async () => {
    "use server";
    await deleteNote(note.id);
  };

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
            แก้ไขโน้ต
          </h1>
          <NoteForm
            initialTitle={note.title}
            initialBody={note.body}
            submitLabel="บันทึก"
            cancelHref="/dashboard"
            onSubmit={updateAction}
            onDelete={deleteAction}
          />
        </div>
      </div>
      <BottomTabs active="home" />
    </div>
  );
}
