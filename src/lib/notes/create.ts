import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractTitleBody } from "@/lib/ai/note-extract";

export type CreateNoteResult =
  | { ok: true; noteId: string; title: string }
  | { ok: false; reason: "not_linked" | "db_error"; error?: string };

/**
 * Create a note from a LINE message. The LINE userId is mapped to a
 * Supabase auth.users row via lungnote_profiles. If no profile exists,
 * the user must link their account first via the `dashboard` flow.
 *
 * The text is run through extractTitleBody (LLM) to produce a concise
 * title and a body. Falls back to a deterministic first-line split if
 * the LLM call fails.
 */
export async function createNoteFromLine(
  lineUserId: string,
  text: string,
): Promise<CreateNoteResult> {
  const sb = createAdminClient();

  // 1. Look up the linked Supabase user.
  const { data: profile, error: profErr } = await sb
    .from("lungnote_profiles")
    .select("id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (profErr) {
    return { ok: false, reason: "db_error", error: profErr.message };
  }
  if (!profile) {
    return { ok: false, reason: "not_linked" };
  }

  // 2. Extract title + body via the LLM (with deterministic fallback).
  const { title, body } = await extractTitleBody(text);
  if (!title) {
    // Should be impossible if text was non-empty, but guard anyway.
    return { ok: false, reason: "db_error", error: "empty title" };
  }

  // 3. Insert the note (service-role bypasses RLS; user_id sourced from profile).
  const { data: noteRow, error: insErr } = await sb
    .from("lungnote_notes")
    .insert({ user_id: profile.id, title, body })
    .select("id")
    .single();

  if (insErr || !noteRow) {
    return {
      ok: false,
      reason: "db_error",
      error: insErr?.message ?? "insert returned no row",
    };
  }

  return { ok: true, noteId: noteRow.id, title };
}
