import { createClient } from "@/lib/supabase/server";
import { SketchyFilter } from "../SketchyFilter";
import { Topbar } from "../Topbar";
import { BottomTabs } from "../BottomTabs";
import { Sidebar } from "../Sidebar";
import { TodoListClient, type TodoRow } from "./TodoListClient";
import { PullToRefresh } from "../PullToRefresh";
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

  const [profileRes, todosRes, openCountRes, notesCountRes] = await Promise.all([
    supabase
      .from("lungnote_profiles")
      .select("line_display_name, line_picture_url")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("lungnote_todos")
      .select(
        "id, text, done, position, due_at, due_text, created_at, updated_at, source, source_url",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("lungnote_todos")
      .select("*", { count: "exact", head: true })
      .eq("done", false),
    supabase
      .from("lungnote_notes")
      .select("*", { count: "exact", head: true }),
  ]);

  const profile = profileRes.data;
  const todos = todosRes.data ?? [];
  const openCount = openCountRes.count;
  const notesCount = notesCountRes.count;

  // Enrich email-sourced todos with AI-suggested reply chips + reply state.
  const emailIds = todos.filter((t) => t.source === "email").map((t) => t.id);
  const actionsByTodo: Record<string, unknown[]> = {};
  const repliedSet = new Set<string>();
  if (emailIds.length > 0) {
    const [syncedRes, repliesRes] = await Promise.all([
      supabase
        .from("lungnote_gmail_synced_messages")
        .select("todo_id, suggested_actions")
        .in("todo_id", emailIds),
      supabase
        .from("lungnote_email_replies")
        .select("todo_id")
        .in("todo_id", emailIds)
        .eq("status", "sent"),
    ]);
    for (const r of syncedRes.data ?? []) {
      if (r.todo_id) {
        actionsByTodo[r.todo_id] = Array.isArray(r.suggested_actions)
          ? (r.suggested_actions as unknown[])
          : [];
      }
    }
    for (const r of repliesRes.data ?? []) {
      if (r.todo_id) repliedSet.add(r.todo_id);
    }
  }
  const initialRows = todos.map((t) => ({
    ...t,
    suggested_actions: (actionsByTodo[t.id] ??
      []) as TodoRow["suggested_actions"],
    replied: repliedSet.has(t.id),
  }));

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
          <PullToRefresh>
            <div className="dash-body">
              <TodoListClient initial={initialRows as TodoRow[]} />
            </div>
          </PullToRefresh>
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
