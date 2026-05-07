import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "../../DashboardHeader";
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

  return (
    <div className="lungnote-dashboard">
      <div className="dash-wrap">
        <DashboardHeader
          displayName={profile?.line_display_name ?? null}
          pictureUrl={profile?.line_picture_url ?? null}
          locale={locale}
        />
        <h1 className="dash-section-title">สร้างโน้ตใหม่</h1>
        <NoteForm
          submitLabel="บันทึก"
          cancelHref="/dashboard"
          onSubmit={createNote}
        />
      </div>
    </div>
  );
}
