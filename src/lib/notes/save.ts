import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type SaveNoteResult =
  | { ok: true; noteId: string; title: string }
  | { ok: false; reason: "not_linked" | "db_error" | "empty"; error?: string };

/**
 * Insert a row in lungnote_notes for a chat-captured note (typically a saved
 * URL or other free-form snippet). Different from saveMemoryRaw, which creates
 * a todo under the Inbox note — this creates a top-level note that appears on
 * the dashboard's "โน้ตล่าสุด / Recent Notes" list.
 *
 * Title is capped at 200 chars to satisfy the DB CHECK constraint.
 */
export async function saveNoteRaw(opts: {
  lineUserId: string;
  title: string;
  body?: string;
}): Promise<SaveNoteResult> {
  const title = opts.title.trim();
  if (!title) return { ok: false, reason: "empty" };

  const sb = createAdminClient();

  const { data: profile, error: profErr } = await sb
    .from("lungnote_profiles")
    .select("id")
    .eq("line_user_id", opts.lineUserId)
    .maybeSingle();

  if (profErr) return { ok: false, reason: "db_error", error: profErr.message };
  if (!profile) return { ok: false, reason: "not_linked" };

  const { data: row, error: insErr } = await sb
    .from("lungnote_notes")
    .insert({
      user_id: profile.id,
      title: title.slice(0, 200),
      body: (opts.body ?? "").trim(),
    })
    .select("id")
    .single();

  if (insErr || !row) {
    return {
      ok: false,
      reason: "db_error",
      error: insErr?.message ?? "insert returned no row",
    };
  }

  return { ok: true, noteId: row.id, title: title.slice(0, 200) };
}
