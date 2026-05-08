import { createClient } from "@/lib/supabase/server";
import { SketchyFilter } from "../SketchyFilter";
import { Topbar } from "../Topbar";
import { BottomTabs } from "../BottomTabs";
import { Sidebar } from "../Sidebar";
import { TodoListClient, type TodoRow } from "./TodoListClient";
import "../dashboard.css";
import "./todo.css";

export const dynamic = "force-dynamic";

export default async function TodoPage({
  params,
}: PageProps<"/[locale]/dashboard/todo">) {
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

  const { data: todos } = await supabase
    .from("lungnote_todos")
    .select("id, text, done, position, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(500);

  const { count: openCount } = await supabase
    .from("lungnote_todos")
    .select("*", { count: "exact", head: true })
    .eq("done", false);

  const { count: notesCount } = await supabase
    .from("lungnote_notes")
    .select("*", { count: "exact", head: true });

  const displayName = profile?.line_display_name ?? "ผู้ใช้ LINE";
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="lungnote-dashboard">
      <SketchyFilter />
      <div className="dash-shell">
        <Sidebar
          active="todo"
          notesCount={notesCount ?? undefined}
          todoCount={openCount ?? undefined}
        />
        <main className="dash-main">
          <Topbar
            pictureUrl={profile?.line_picture_url ?? null}
            initial={initial}
            locale={locale}
          />
          <div className="dash-body">
            <TodoListClient initial={(todos ?? []) as TodoRow[]} />
          </div>
        </main>
      </div>
      <BottomTabs
        active="todo"
        notesCount={notesCount ?? undefined}
        todoCount={openCount ?? undefined}
      />
    </div>
  );
}
