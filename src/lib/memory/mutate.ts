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
