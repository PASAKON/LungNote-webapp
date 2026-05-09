/**
 * Agent QA harness — runs each scenario through the real runAgent stack
 * with an in-memory Supabase mock and a real OpenRouter LLM call.
 *
 * Skip the whole suite when OPENROUTER_API_KEY is missing so unit-test
 * runs in CI without secrets stay green. Run locally with:
 *
 *   pnpm test:agent
 *
 * which loads .env.local before vitest starts.
 */
import { describe, it, beforeAll, beforeEach, vi } from "vitest";
import {
  createMockState,
  setMockState,
  getMockState,
  mockSupabaseClient,
} from "./__support__/mock-supabase";
import {
  SCENARIOS,
  TEST_LINE_USER_ID,
  TEST_USER_ID,
  TEST_INBOX_NOTE_ID,
  type Scenario,
} from "./__support__/scenarios";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockSupabaseClient(),
}));
vi.mock("@/lib/line/client", () => ({
  replyMessage: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
  displayLoadingAnimation: vi
    .fn()
    .mockResolvedValue({ ok: true, status: 202 }),
}));
vi.mock("@/lib/auth/line-link", () => ({
  mintToken: vi.fn(async () => ({ token: "test-token-abc123" })),
}));

import { runAgent } from "@/lib/agent/runtime";
import { TurnContext } from "@/lib/agent/context";
import { TraceCollector } from "@/lib/observability/trace";

const HAS_KEY = !!process.env.OPENROUTER_API_KEY;

function seedProfile() {
  return {
    id: TEST_USER_ID,
    line_user_id: TEST_LINE_USER_ID,
    line_display_name: "QA Tester",
    line_picture_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function seedNote() {
  return {
    id: TEST_INBOX_NOTE_ID,
    user_id: TEST_USER_ID,
    title: "📥 Inbox",
    body: "",
  };
}

describe.skipIf(!HAS_KEY)("Agent QA scenarios (real OpenRouter)", () => {
  beforeAll(() => {
    if (!HAS_KEY) {
      console.warn("OPENROUTER_API_KEY missing — skipping agent scenarios");
    }
  });

  beforeEach(() => {
    setMockState(
      createMockState({
        profiles: [seedProfile()],
        notes: [seedNote()],
      }),
    );
  });

  for (const scenario of SCENARIOS) {
    runScenario(scenario);
  }
});

function runScenario(scenario: Scenario) {
  it(
    scenario.name,
    async () => {
      // Seed scenario-specific todos.
      if (scenario.seedTodos) {
        const state = getMockState();
        state.todos.push(...scenario.seedTodos());
      }

      const trace = new TraceCollector(
        `qa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        TEST_LINE_USER_ID,
        scenario.userText,
      );
      const ctx = new TurnContext(TEST_LINE_USER_ID, trace);
      const result = await runAgent(scenario.userText, ctx);

      // Collect actual tool calls from trace.
      const actualCalls = collectToolCalls(trace);

      // Helpful debug on failure.
      const debug = () => ({
        userText: scenario.userText,
        replyText: result.ok ? result.text : "(error)",
        replyError: result.ok ? null : result.error,
        actualCalls,
        finalTodos: getMockState().todos.map((t) => ({
          text: t.text,
          done: t.done,
          due_at: t.due_at,
        })),
      });

      try {
        // 1. Run completed (or expected to ask without tool — still ok)
        if (!result.ok) {
          throw new Error(
            `agent failed: ${result.reason} ${result.error ?? ""}`,
          );
        }

        // 2. Tool call assertions (loose, order-tolerant within iter)
        if (scenario.expect.toolCalls) {
          for (const expected of scenario.expect.toolCalls) {
            const match = actualCalls.find(
              (c) =>
                c.name === expected.name &&
                (!expected.argsMatch || expected.argsMatch(c.args)),
            );
            if (!match) {
              throw new Error(
                `missing expected tool call: ${expected.name}` +
                  (expected.argsMatch ? " (with matching args)" : ""),
              );
            }
          }
          if (scenario.expect.toolCalls.length === 0 && actualCalls.length > 0) {
            throw new Error(
              `expected NO tool calls, got: ${actualCalls.map((c) => c.name).join(",")}`,
            );
          }
        }

        // 3. Reply text matchers
        if (scenario.expect.replyMatches) {
          if (!scenario.expect.replyMatches.test(result.text)) {
            throw new Error(
              `reply did not match ${scenario.expect.replyMatches}\nGot: "${result.text}"`,
            );
          }
        }
        if (scenario.expect.replyMustNotMatch) {
          if (scenario.expect.replyMustNotMatch.test(result.text)) {
            throw new Error(
              `reply unexpectedly matched ${scenario.expect.replyMustNotMatch}\nGot: "${result.text}"`,
            );
          }
        }

        // 4. Final state assertion
        if (scenario.expect.finalState) {
          scenario.expect.finalState(getMockState().todos);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const dump = JSON.stringify(debug(), null, 2);
        throw new Error(`${msg}\n\n--- debug ---\n${dump}`);
      }
    },
    { timeout: 30_000 },
  );
}

function collectToolCalls(trace: TraceCollector) {
  return trace.getToolCalls() as ReadonlyArray<{
    name: string;
    args: Record<string, unknown>;
    result: unknown;
  }>;
}
