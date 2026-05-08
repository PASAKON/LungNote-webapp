import "server-only";
import { chatCompletion, AIClientError, type WireMessage } from "./client";
import { buildPromptMessages } from "./prompts";
import { loadMemory, saveMemory } from "./memory";
import { TOOL_DEFS, executeToolCall, type ToolCall } from "./tools";
import type { AIReplyResult } from "./types";

// 5 iterations covers the worst legit shape: list_done → uncomplete →
// list_pending (verify) → maybe one more mutation → final text.
// Most intents finish in 2-3.
const MAX_TOOL_ITERATIONS = 5;

/**
 * Generate an AI reply for a single user message — ADR-0012 Phase 2.
 *
 * Agentic loop: the model may call save_memory or list_pending. We execute
 * the calls, append the tool results, and loop back up to MAX_TOOL_ITERATIONS
 * times until the model returns plain text.
 *
 * Conversation memory (rolling 5+5 in lungnote_conversation_memory) only
 * persists user + final assistant text turns — tool calls and tool results
 * are intermediate scaffolding and would just inflate prompts.
 *
 * Memory load and save are best-effort: a DB outage degrades to a stateless
 * reply but never blocks the response. Anonymous (lineUserId="anonymous")
 * sessions get tools stripped — there's no DB scope to attach saves to.
 */
export async function generateChatReply(
  lineUserId: string,
  userText: string,
): Promise<AIReplyResult> {
  const isAnonymous = lineUserId === "anonymous";
  const memory = await loadMemory(lineUserId);

  // Seed wire-format conversation from base prompt + memory + this turn.
  const seed = buildPromptMessages(memory, userText);
  const wire: WireMessage[] = seed.map((m) => {
    if (m.role === "system") return { role: "system", content: m.content };
    if (m.role === "user") return { role: "user", content: m.content };
    return { role: "assistant", content: m.content };
  });

  // Aggregate metadata across loop iterations.
  let totalLatency = 0;
  let totalIn = 0;
  let totalOut = 0;
  let totalCost = 0;
  let lastModel = "";

  try {
    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      const result = await chatCompletion(wire, {
        // Tools only make sense for linked users.
        tools: isAnonymous ? undefined : TOOL_DEFS,
      });

      totalLatency += result.latencyMs;
      totalIn += result.tokensIn;
      totalOut += result.tokensOut;
      totalCost += result.costEstimate;
      lastModel = result.model;

      // Plain text reply — we're done.
      if (!result.toolCalls) {
        const finalText = result.text;

        // Persist user + final assistant turn (skip tool scaffolding).
        void saveMemory(lineUserId, memory, userText, finalText).catch(
          (err: unknown) => {
            console.error("saveMemory rejected", { lineUserId, err });
          },
        );

        return {
          ok: true,
          text: finalText,
          meta: {
            model: lastModel,
            latencyMs: totalLatency,
            tokensIn: totalIn,
            tokensOut: totalOut,
            costEstimate: totalCost,
          },
        };
      }

      // Model wants to call tools — append assistant turn + execute each call.
      wire.push({
        role: "assistant",
        content: result.text || null,
        tool_calls: result.toolCalls,
      });

      const toolResults = await executeAllTools(
        result.toolCalls,
        isAnonymous ? null : lineUserId,
      );
      for (const tr of toolResults) {
        wire.push({ role: "tool", tool_call_id: tr.tool_call_id, content: tr.content });
      }
    }

    // Loop exhausted without a final text — treat as error.
    return {
      ok: false,
      reason: "ai_error",
      error: `tool loop exceeded ${MAX_TOOL_ITERATIONS} iterations without final text`,
    };
  } catch (err) {
    const isTimeout =
      err instanceof AIClientError && /timed out/i.test(err.message);
    const reason = isTimeout ? "ai_timeout" : "ai_error";
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, reason, error };
  }
}

/**
 * Execute tool calls in parallel. They're independent (save and list don't
 * race on the same row) so concurrency is safe and shaves end-to-end latency.
 */
async function executeAllTools(
  calls: ToolCall[],
  lineUserId: string | null,
) {
  return Promise.all(calls.map((c) => executeToolCall(c, lineUserId)));
}
