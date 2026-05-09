import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Agent settings (singleton row in lungnote_agent_settings) — lets admin
 * hot-swap the system prompt without a redeploy (ClaudeFlow pattern).
 * When `system_prompt_override` is NULL, the runtime falls back to the
 * hardcoded `buildStaticSystemPrompt()`.
 *
 * Cached in-process for `CACHE_TTL_MS` so each webhook doesn't pay a
 * Supabase round trip. On Vercel each cold-start gets its own cache;
 * change propagation = up to TTL on already-warm instances.
 */
export type AgentSettings = {
  systemPromptOverride: string | null;
  notes: string | null;
  updatedAt: string;
};

const CACHE_TTL_MS = 60_000; // 60s — short enough to iterate, long enough to amortize.
let cachedAt = 0;
let cached: AgentSettings | null = null;

/** Force-clear the cache (test seam + admin "apply now" hook). */
export function invalidateAgentSettingsCache(): void {
  cachedAt = 0;
  cached = null;
}

export async function loadAgentSettings(): Promise<AgentSettings> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached;

  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("lungnote_agent_settings")
      .select("system_prompt_override, notes, updated_at")
      .eq("id", "default")
      .maybeSingle();

    if (error || !data) {
      // Soft fail — never break the agent on settings outage.
      cached = { systemPromptOverride: null, notes: null, updatedAt: "" };
    } else {
      const row = data as {
        system_prompt_override: string | null;
        notes: string | null;
        updated_at: string;
      };
      cached = {
        systemPromptOverride: row.system_prompt_override,
        notes: row.notes,
        updatedAt: row.updated_at,
      };
    }
  } catch (err) {
    console.error("loadAgentSettings failed (using fallback)", err);
    cached = { systemPromptOverride: null, notes: null, updatedAt: "" };
  }
  cachedAt = now;
  return cached;
}
