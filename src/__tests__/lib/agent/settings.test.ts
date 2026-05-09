import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadAgentSettings,
  invalidateAgentSettingsCache,
} from "@/lib/agent/settings";

// Mock the admin client to avoid hitting real Supabase. We just exercise
// the cache + soft-fail behavior — DB schema is integration-tested.
vi.mock("@/lib/supabase/admin", () => {
  const calls = { count: 0, override: null as string | null };
  return {
    createAdminClient: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              calls.count += 1;
              return {
                data: {
                  system_prompt_override: calls.override,
                  notes: null,
                  updated_at: "2026-05-09T00:00:00Z",
                },
                error: null,
              };
            },
          }),
        }),
      }),
    }),
    __mockState: calls,
  };
});

describe("agent settings", () => {
  beforeEach(() => {
    invalidateAgentSettingsCache();
  });

  it("returns null override when DB row has none → runtime falls back to code prompt", async () => {
    const s = await loadAgentSettings();
    expect(s.systemPromptOverride).toBeNull();
  });

  it("caches the result for subsequent calls within TTL", async () => {
    const adminMod = await import("@/lib/supabase/admin");
    const state = (adminMod as unknown as { __mockState: { count: number } })
      .__mockState;
    state.count = 0;

    await loadAgentSettings();
    await loadAgentSettings();
    await loadAgentSettings();
    // 1 fetch, 2 cache hits.
    expect(state.count).toBe(1);
  });

  it("invalidateAgentSettingsCache forces re-fetch", async () => {
    const adminMod = await import("@/lib/supabase/admin");
    const state = (adminMod as unknown as { __mockState: { count: number } })
      .__mockState;
    state.count = 0;

    await loadAgentSettings();
    invalidateAgentSettingsCache();
    await loadAgentSettings();
    expect(state.count).toBe(2);
  });

  it("returns override string when DB row has one set", async () => {
    const adminMod = await import("@/lib/supabase/admin");
    const state = (
      adminMod as unknown as {
        __mockState: { count: number; override: string | null };
      }
    ).__mockState;
    state.override = "custom prompt from DB";

    invalidateAgentSettingsCache();
    const s = await loadAgentSettings();
    expect(s.systemPromptOverride).toBe("custom prompt from DB");
  });
});
