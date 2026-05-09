import "server-only";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { loadMemory, saveMemory } from "@/lib/ai/memory";
import { TurnContext } from "./context";
import { ALL_TOOLS } from "./tools";
import { buildToolSet } from "./registry";
import { buildSystemPrompt } from "./prompt";

const DEFAULT_MODEL = "google/gemini-2.5-flash";
const MAX_STEPS = 5;
const MAX_OUTPUT_TOKENS = 400;

// Approximate Gemini 2.5 Flash pricing (USD per 1M tokens). Update if model changes.
const PRICE_INPUT_PER_M = 0.075;
const PRICE_OUTPUT_PER_M = 0.3;

export type AgentReply =
  | {
      ok: true;
      text: string;
      meta: {
        model: string;
        latencyMs: number;
        tokensIn: number;
        tokensOut: number;
        costEstimate: number;
        steps: number;
      };
    }
  | {
      ok: false;
      reason: "ai_error" | "ai_timeout";
      error?: string;
    };

/**
 * Run one agent turn. Pulls conversation memory, builds the tool set bound
 * to a TurnContext, calls Vercel AI SDK with maxSteps=5, then persists the
 * user + final-assistant pair into rolling memory.
 *
 * Tool calls/results are NOT persisted into conversation memory — they're
 * intermediate scaffolding and would inflate every subsequent turn's prompt.
 * The trace store (lungnote_chat_traces) keeps the full record for admin.
 */
export async function runAgent(
  userText: string,
  ctx: TurnContext,
): Promise<AgentReply> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "ai_error", error: "OPENROUTER_API_KEY missing" };
  }
  const memoryKey = ctx.lineUserId ?? "anonymous";
  const memory = await loadMemory(memoryKey);
  ctx.trace.historyCount = memory.length;
  ctx.trace.step("memory_load", { count: memory.length });

  const openrouter = createOpenRouter({ apiKey });
  const model = openrouter.chat(DEFAULT_MODEL);
  const tools = buildToolSet(ALL_TOOLS, ctx);

  const messages = [
    { role: "system" as const, content: buildSystemPrompt(new Date()) },
    ...memory.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userText },
  ];

  const start = Date.now();
  try {
    const result = await generateText({
      model,
      messages,
      tools,
      stopWhen: ({ steps }) => steps.length >= MAX_STEPS,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });

    const latencyMs = Date.now() - start;
    const tokensIn = result.usage?.inputTokens ?? 0;
    const tokensOut = result.usage?.outputTokens ?? 0;
    const costEstimate =
      (tokensIn * PRICE_INPUT_PER_M + tokensOut * PRICE_OUTPUT_PER_M) /
      1_000_000;
    const stepCount = result.steps?.length ?? 1;

    ctx.trace.aiIterations = stepCount;
    ctx.trace.step("agent_done", {
      steps: stepCount,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      latency_ms: latencyMs,
    });

    const finalText = (result.text ?? "").trim();
    if (!finalText) {
      return {
        ok: false,
        reason: "ai_error",
        error: "agent finished without text reply",
      };
    }

    // Persist user + final assistant turn (skip tool scaffolding).
    void saveMemory(memoryKey, memory, userText, finalText).catch(
      (err: unknown) => {
        console.error("saveMemory rejected", { memoryKey, err });
      },
    );

    return {
      ok: true,
      text: finalText,
      meta: {
        model: DEFAULT_MODEL,
        latencyMs,
        tokensIn,
        tokensOut,
        costEstimate,
        steps: stepCount,
      },
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const isTimeout =
      err instanceof Error && /timed?out|aborted/i.test(err.message);
    ctx.trace.step("agent_error", {
      latency_ms: latencyMs,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      reason: isTimeout ? "ai_timeout" : "ai_error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Re-export for tests / external use.
export { TurnContext };
