import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractMemory } from "@/lib/ai/memory-extract";

const INBOX_TITLE = "📥 Inbox";

export type SaveMemoryResult =
  | {
      ok: true;
      todoId: string;
      text: string;
      dueAt: string | null;
      dueText: string | null;
    }
  | { ok: false; reason: "not_linked" | "db_error" | "empty"; error?: string };

/**
 * Save a memory item from a LINE chat message — ADR-0012.
 *
 * Maps lineUserId → Supabase user via lungnote_profiles, lazy-creates the
 * user's "📥 Inbox" container note (since lungnote_todos.note_id is NOT NULL),
 * runs the text through the date-aware extractor, and inserts a row in
 * lungnote_todos with source='chat'.
 */
export async function saveMemoryFromLine(
  lineUserId: string,
  rawText: string,
): Promise<SaveMemoryResult> {
  const extraction = await extractMemory(rawText);
  if (!extraction.text) return { ok: false, reason: "empty" };
  return saveMemoryRaw({
    lineUserId,
    text: extraction.text,
    dueAt: extraction.due_at,
    dueText: extraction.due_text,
  });
}

/**
 * Save a pre-extracted memory item — ADR-0012 Phase 2 (tool-calling).
 *
 * Used by the AI reply loop when the model calls `save_memory` with a clean
 * text + already-resolved date. Skips the extra LLM extract round-trip.
 */
export async function saveMemoryRaw(opts: {
  lineUserId: string;
  text: string;
  dueAt: string | null;
  dueText: string | null;
}): Promise<SaveMemoryResult> {
  const { lineUserId, text, dueAt, dueText } = opts;
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  const sb = createAdminClient();

  const { data: profile, error: profErr } = await sb
    .from("lungnote_profiles")
    .select("id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (profErr) return { ok: false, reason: "db_error", error: profErr.message };
  if (!profile) return { ok: false, reason: "not_linked" };

  const userId = profile.id;

  const inboxId = await getOrCreateInboxAdmin(userId);
  if (!inboxId) {
    return { ok: false, reason: "db_error", error: "inbox create failed" };
  }

  const { data: row, error: insErr } = await sb
    .from("lungnote_todos")
    .insert({
      user_id: userId,
      note_id: inboxId,
      text: trimmed.slice(0, 2000),
      due_at: dueAt,
      due_text: dueText,
      source: "chat",
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

  return {
    ok: true,
    todoId: row.id,
    text: trimmed,
    dueAt,
    dueText,
  };
}

async function getOrCreateInboxAdmin(userId: string): Promise<string | null> {
  const sb = createAdminClient();

  const { data: existing } = await sb
    .from("lungnote_notes")
    .select("id")
    .eq("user_id", userId)
    .eq("title", INBOX_TITLE)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await sb
    .from("lungnote_notes")
    .insert({ user_id: userId, title: INBOX_TITLE, body: "" })
    .select("id")
    .single();

  if (error || !created) return null;
  return created.id;
}
