import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type MutateResult =
  | { ok: true; todoId: string; text: string }
  | {
      ok: false;
      reason: "not_linked" | "not_found" | "db_error";
      error?: string;
    };

/**
 * Resolve a LINE user to their Supabase user_id. Returns null if no linked
 * profile exists.
 */
async function resolveUserId(lineUserId: string): Promise<string | null> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("lungnote_profiles")
    .select("id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (error || !data) return null;
  return data.id;
}

/** Mark a todo done — used by the AI `complete_memory` tool. */
export async function completeMemory(
  lineUserId: string,
  todoId: string,
): Promise<MutateResult> {
  const userId = await resolveUserId(lineUserId);
  if (!userId) return { ok: false, reason: "not_linked" };

  const sb = createAdminClient();
  // Defense in depth: scope by user_id even though admin client bypasses RLS,
  // so a hallucinated id from the model can't touch someone else's row.
  const { data, error } = await sb
    .from("lungnote_todos")
    .update({ done: true })
    .eq("id", todoId)
    .eq("user_id", userId)
    .select("id, text")
    .maybeSingle();

  if (error) return { ok: false, reason: "db_error", error: error.message };
  if (!data) return { ok: false, reason: "not_found" };
  return { ok: true, todoId: data.id, text: data.text };
}

/** Re-open a completed todo — used by the AI `uncomplete_memory` tool. */
export async function uncompleteMemory(
  lineUserId: string,
  todoId: string,
): Promise<MutateResult> {
  const userId = await resolveUserId(lineUserId);
  if (!userId) return { ok: false, reason: "not_linked" };

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("lungnote_todos")
    .update({ done: false })
    .eq("id", todoId)
    .eq("user_id", userId)
    .select("id, text")
    .maybeSingle();

  if (error) return { ok: false, reason: "db_error", error: error.message };
  if (!data) return { ok: false, reason: "not_found" };
  return { ok: true, todoId: data.id, text: data.text };
}

/**
 * Patch a todo's text and/or due date — used by the AI `update_memory` tool.
 *
 * All fields optional. `due_at: null` clears the date; `due_at: undefined`
 * leaves it untouched. Same for `text` and `due_text`.
 */
export async function updateMemory(
  lineUserId: string,
  todoId: string,
  patch: {
    text?: string;
    due_at?: string | null;
    due_text?: string | null;
  },
): Promise<MutateResult> {
  const userId = await resolveUserId(lineUserId);
  if (!userId) return { ok: false, reason: "not_linked" };

  const update: {
    text?: string;
    due_at?: string | null;
    due_text?: string | null;
  } = {};
  if (patch.text !== undefined) {
    const trimmed = patch.text.trim();
    if (!trimmed) return { ok: false, reason: "db_error", error: "empty text" };
    update.text = trimmed.slice(0, 2000);
  }
  if (patch.due_at !== undefined) update.due_at = patch.due_at;
  if (patch.due_text !== undefined) update.due_text = patch.due_text;

  if (Object.keys(update).length === 0) {
    return { ok: false, reason: "db_error", error: "no fields to update" };
  }

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("lungnote_todos")
    .update(update)
    .eq("id", todoId)
    .eq("user_id", userId)
    .select("id, text")
    .maybeSingle();

  if (error) return { ok: false, reason: "db_error", error: error.message };
  if (!data) return { ok: false, reason: "not_found" };
  return { ok: true, todoId: data.id, text: data.text };
}

/** Delete a todo — used by the AI `delete_memory` tool. */
export async function deleteMemory(
  lineUserId: string,
  todoId: string,
): Promise<MutateResult> {
  const userId = await resolveUserId(lineUserId);
  if (!userId) return { ok: false, reason: "not_linked" };

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("lungnote_todos")
    .delete()
    .eq("id", todoId)
    .eq("user_id", userId)
    .select("id, text")
    .maybeSingle();

  if (error) return { ok: false, reason: "db_error", error: error.message };
  if (!data) return { ok: false, reason: "not_found" };
  return { ok: true, todoId: data.id, text: data.text };
}
