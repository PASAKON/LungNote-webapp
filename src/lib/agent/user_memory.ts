import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type UserMemory = Record<string, unknown>;

/**
 * Load the persistent memory JSON for a LINE user. Returns {} when no row
 * yet (first encounter). Errors logged + treated as empty so agent flow
 * never blocks on memory IO.
 */
export async function loadUserMemory(
  lineUserId: string,
): Promise<UserMemory> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("lungnote_user_memory")
    .select("memory")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (error) {
    console.error("loadUserMemory error", { lineUserId, err: error.message });
    return {};
  }
  return ((data?.memory as UserMemory | null) ?? {}) as UserMemory;
}

/**
 * Update one field of a user's memory. action='set' overwrites, action='delete'
 * removes the key. Array values get merged (union) when both old + new are
 * arrays, mirroring the ClaudeFlow convention so the agent can incrementally
 * grow lists like "subjects studying".
 */
export async function updateUserMemory(
  lineUserId: string,
  action: "set" | "delete",
  key: string,
  value: unknown,
): Promise<UserMemory> {
  const sb = createAdminClient();
  const current = await loadUserMemory(lineUserId);
  const next = { ...current };

  if (action === "set") {
    if (Array.isArray(next[key]) && Array.isArray(value)) {
      const merged = [...(next[key] as unknown[])];
      for (const v of value as unknown[]) {
        if (!merged.includes(v)) merged.push(v);
      }
      next[key] = merged;
    } else {
      next[key] = value;
    }
  } else {
    delete next[key];
  }

  const { error } = await sb
    .from("lungnote_user_memory")
    .upsert(
      {
        line_user_id: lineUserId,
        memory: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "line_user_id" },
    );
  if (error) {
    console.error("updateUserMemory upsert error", {
      lineUserId,
      err: error.message,
    });
  }
  return next;
}
