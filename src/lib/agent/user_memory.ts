import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type UserMemory = Record<string, unknown>;

/**
 * Standing rule (directive) — a persistent instruction the user gave the agent
 * ("when X, do Y"). Stored compactly under the reserved memory key `_r` so it
 * rides into the prompt with the rest of USER MEMORY at zero extra IO. Keys are
 * single-letter to minimise prompt tokens (ADR-0022):
 *   id — stable slug for remove/dedup
 *   w  — when: the trigger phrase / situation
 *   d  — do: the action to take
 *   a  — ask mode: 0 = do immediately, 1 = ask once first, 2 = just warn
 */
export type StandingRule = {
  id: string;
  w: string;
  d: string;
  a: 0 | 1 | 2;
};

export const RULES_KEY = "_r";

function readRules(mem: UserMemory): StandingRule[] {
  const raw = mem[RULES_KEY];
  return Array.isArray(raw) ? (raw as StandingRule[]) : [];
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9ก-๙]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || `r-${Date.now().toString(36)}`
  );
}

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

async function writeMemory(
  lineUserId: string,
  next: UserMemory,
): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb.from("lungnote_user_memory").upsert(
    {
      line_user_id: lineUserId,
      memory: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "line_user_id" },
  );
  if (error) {
    console.error("writeMemory upsert error", { lineUserId, err: error.message });
  }
}

/** Read the user's standing rules (directives). */
export async function listRules(lineUserId: string): Promise<StandingRule[]> {
  return readRules(await loadUserMemory(lineUserId));
}

/**
 * Add or overwrite a standing rule. Dedup by id — same id replaces in place,
 * so re-stating a rule the user gives repeatedly stays a single entry. Returns
 * the full rule list after the change.
 */
export async function addRule(
  lineUserId: string,
  rule: { when: string; do: string; ask: 0 | 1 | 2; id?: string },
): Promise<StandingRule[]> {
  const mem = await loadUserMemory(lineUserId);
  const rules = readRules(mem);
  const id = rule.id?.trim() || slugify(rule.when);
  const entry: StandingRule = { id, w: rule.when, d: rule.do, a: rule.ask };
  const idx = rules.findIndex((r) => r.id === id);
  if (idx >= 0) rules[idx] = entry;
  else rules.push(entry);
  await writeMemory(lineUserId, { ...mem, [RULES_KEY]: rules });
  return rules;
}

/** Remove a standing rule by id. Returns the remaining rules. */
export async function removeRule(
  lineUserId: string,
  id: string,
): Promise<StandingRule[]> {
  const mem = await loadUserMemory(lineUserId);
  const rules = readRules(mem).filter((r) => r.id !== id);
  await writeMemory(lineUserId, { ...mem, [RULES_KEY]: rules });
  return rules;
}
