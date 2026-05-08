import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type ListMemoryResult =
  | {
      ok: true;
      items: Array<{
        id: string;
        text: string;
        due_at: string | null;
        due_text: string | null;
        created_at: string;
      }>;
    }
  | { ok: false; reason: "not_linked" | "db_error"; error?: string };

const MAX_ROWS = 20;

/**
 * List pending memory items (done=false) for a LINE user, ordered by:
 *   1. items with due_at first (soonest due)
 *   2. then created_at desc
 * Capped at MAX_ROWS so the LINE reply stays readable.
 */
export async function listPendingFromLine(
  lineUserId: string,
): Promise<ListMemoryResult> {
  const sb = createAdminClient();

  const { data: profile, error: profErr } = await sb
    .from("lungnote_profiles")
    .select("id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (profErr) return { ok: false, reason: "db_error", error: profErr.message };
  if (!profile) return { ok: false, reason: "not_linked" };

  // Two queries: due-first (sorted by due_at asc), then no-due (recent).
  // PostgREST order doesn't put nulls predictably for our case, so split.
  const [dueRes, plainRes] = await Promise.all([
    sb
      .from("lungnote_todos")
      .select("id, text, due_at, due_text, created_at")
      .eq("user_id", profile.id)
      .eq("done", false)
      .not("due_at", "is", null)
      .order("due_at", { ascending: true })
      .limit(MAX_ROWS),
    sb
      .from("lungnote_todos")
      .select("id, text, due_at, due_text, created_at")
      .eq("user_id", profile.id)
      .eq("done", false)
      .is("due_at", null)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS),
  ]);

  if (dueRes.error) {
    return { ok: false, reason: "db_error", error: dueRes.error.message };
  }
  if (plainRes.error) {
    return { ok: false, reason: "db_error", error: plainRes.error.message };
  }

  const items = [...(dueRes.data ?? []), ...(plainRes.data ?? [])].slice(
    0,
    MAX_ROWS,
  );

  return { ok: true, items };
}
