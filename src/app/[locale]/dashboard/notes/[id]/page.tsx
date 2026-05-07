import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "../../DashboardHeader";
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
      <div className="dash-wrap">
        <DashboardHeader
          displayName={profile?.line_display_name ?? null}
          pictureUrl={profile?.line_picture_url ?? null}
          locale={locale}
        />
        <h1 className="dash-section-title">แก้ไขโน้ต</h1>
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
  );
}
