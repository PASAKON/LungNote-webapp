import "server-only";
import { generateText, type ModelMessage } from "ai";
import { loadMemory, saveMemory } from "@/lib/ai/memory";
import type { LineMessage } from "@/lib/line/client";
import { TurnContext } from "./context";
import { ALL_TOOLS } from "./tools";
import { buildToolSet } from "./registry";
import { buildSystemPrompt, buildStaticSystemPrompt, buildTodayBlock } from "./prompt";
import { resolveModel } from "./model";
import { routeModel } from "./router";
import { loadUserMemory } from "@/lib/agent/user_memory";
import { loadAgentSettings } from "./settings";

const MAX_STEPS = 5;
const MAX_OUTPUT_TOKENS = 1024;

export type AgentReply =
  | {
      ok: true;
      /** Joined bubble text — for trace logs / single-bubble fallback path. */
      text: string;
      /**
       * One entry per chat bubble — TextMessage or FlexMessage. If the
       * agent didn't call `send_text_reply` / `send_flex_reply`, this is
       * a single-element array containing a TextMessage with the model's
       * free-form text reply. Webhook flushes each bubble as one LINE
       * message in a single reply call.
       */
      bubbles: LineMessage[];
      meta: {
        model: string;
        latencyMs: number;
        tokensIn: number;
        tokensOut: number;
        costEstimate: number;
        steps: number;
        cacheHit?: boolean;
      };
    }
  | {
      ok: false;
      reason: "ai_error" | "ai_timeout";
      error?: string;
    };

/**
 * Run one agent turn. Pulls conversation memory + persistent user memory,
 * builds the tool set bound to a TurnContext, calls Vercel AI SDK with
 * maxSteps=5, then persists the user + final-assistant pair into rolling
 * memory.
 *
 * Caching: when the resolved provider is Anthropic-direct, the static
 * system prompt is sent as a separate cacheable block via providerOptions.
 * Today's date + per-user memory are sent as a non-cached block so the
 * cache key stays stable across all users for the static portion. With
 * Sonnet, this trims input tokens ~50-60% on cache hits.
 */
export async function runAgent(
  userText: string,
  ctx: TurnContext,
): Promise<AgentReply> {
  const route = routeModel(userText);
  ctx.trace.step("router", { model_id: route.modelId, reason: route.reason });
  let resolved;
  try {
    resolved = resolveModel(route.modelId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "ai_error", error: msg };
  }

  const memoryKey = ctx.lineUserId ?? "anonymous";
  const [history, userMemory, agentSettings] = await Promise.all([
    loadMemory(memoryKey),
    ctx.lineUserId
      ? loadUserMemory(ctx.lineUserId).catch(() => ({}))
      : Promise.resolve({}),
    loadAgentSettings(),
  ]);
  ctx.trace.historyCount = history.length;
  ctx.trace.step("memory_load", {
    count: history.length,
    user_memory_keys: Object.keys(userMemory).length,
    prompt_source: agentSettings.systemPromptOverride ? "db_override" : "code",
  });

  const tools = buildToolSet(ALL_TOOLS, ctx);

  // Static, cacheable: prompt + tool decision tree (everything not user-specific).
  // DB override (lungnote_agent_settings.system_prompt_override) wins so admin
  // can hot-swap without redeploy. Cached in-process 60s.
  const staticPrompt =
    agentSettings.systemPromptOverride ?? buildStaticSystemPrompt();
  // Variable, NOT cached: today's date + per-user memory.
  const dynamicPrompt = buildDynamicSystemSuffix(userMemory);

  // System messages — for Anthropic-flavored caching (direct or via
  // OpenRouter passthrough), split into two blocks with cacheControl on
  // the static one. The cache key is provider-specific:
  //   - anthropic-direct  → providerOptions.anthropic.cacheControl
  //   - openrouter (any anthropic/* model) → providerOptions.openrouter.cacheControl
  // For non-cache-capable models, send a single concatenated system block.
  const systemMessages: ModelMessage[] =
    resolved.supportsCache && resolved.cacheProviderKey
      ? [
          {
            role: "system",
            content: staticPrompt,
            providerOptions: {
              [resolved.cacheProviderKey]: {
                cacheControl: { type: "ephemeral" },
              },
            },
          },
          { role: "system", content: dynamicPrompt },
        ]
      : [{ role: "system", content: staticPrompt + "\n\n" + dynamicPrompt }];

  const messages: ModelMessage[] = [
    ...systemMessages,
    ...history.map((m) => ({ role: m.role, content: m.content }) as ModelMessage),
    { role: "user", content: userText },
  ];

  const start = Date.now();
  try {
    const result = await generateText({
      model: resolved.model,
      messages,
      tools,
      stopWhen: ({ steps }) => steps.length >= MAX_STEPS,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });

    const latencyMs = Date.now() - start;
    const tokensIn = result.usage?.inputTokens ?? 0;
    const tokensOut = result.usage?.outputTokens ?? 0;
    const costEstimate =
      (tokensIn * resolved.priceInputPerM + tokensOut * resolved.priceOutputPerM) /
      1_000_000;
    const stepCount = result.steps?.length ?? 1;

    // Cache hit detection — provider-specific shape:
    //   - Anthropic-direct: providerMetadata.anthropic.cacheReadInputTokens
    //   - OpenRouter (anthropic/* models): providerMetadata.openrouter.usage.promptTokensDetails.cachedTokens
    const providerMeta =
      (result.providerMetadata as
        | {
            anthropic?: {
              cacheReadInputTokens?: number;
              cacheCreationInputTokens?: number;
            };
            openrouter?: {
              usage?: { promptTokensDetails?: { cachedTokens?: number } };
            };
          }
        | undefined) ?? undefined;
    const cacheRead =
      providerMeta?.anthropic?.cacheReadInputTokens ??
      providerMeta?.openrouter?.usage?.promptTokensDetails?.cachedTokens ??
      0;
    const cacheHit = cacheRead > 0;

    ctx.trace.aiIterations = stepCount;
    ctx.trace.step("agent_done", {
      provider: resolved.provider,
      model: resolved.modelId,
      steps: stepCount,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cache_read: cacheRead,
      latency_ms: latencyMs,
    });

    // Multi-bubble: if the agent called send_text_reply / send_flex_reply,
    // prefer those bubbles over result.text (which may be empty when the
    // model routed everything through tool calls). Otherwise fall back to
    // result.text as a single text bubble.
    const bufferedBubbles = ctx.getReplyBubbles();
    const fallbackText = (result.text ?? "").trim();
    const bubbles: LineMessage[] =
      bufferedBubbles.length > 0
        ? bufferedBubbles
        : fallbackText
          ? [{ type: "text", text: fallbackText }]
          : [];
    if (bubbles.length === 0) {
      return {
        ok: false,
        reason: "ai_error",
        error: "agent finished without text reply",
      };
    }
    // For trace logs / saveMemory: collect plain-text view of bubbles.
    const finalText = bubbles
      .map((b) => (b.type === "text" ? b.text : `[flex:${b.altText}]`))
      .join("\n");

    void saveMemory(memoryKey, history, userText, finalText).catch(
      (err: unknown) => {
        console.error("saveMemory rejected", { memoryKey, err });
      },
    );

    return {
      ok: true,
      text: finalText,
      bubbles,
      meta: {
        model: resolved.modelId,
        latencyMs,
        tokensIn,
        tokensOut,
        costEstimate,
        steps: stepCount,
        cacheHit,
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

function buildDynamicSystemSuffix(userMemory: Record<string, unknown>): string {
  const today = buildTodayBlock(new Date());
  const memBlock =
    Object.keys(userMemory).length > 0
      ? `\n\n# USER MEMORY (persistent facts about this user — use freely; never expose JSON)\n${JSON.stringify(userMemory, null, 0)}`
      : "";
  return `${today}${memBlock}`;
}

// Re-export for tests / external use.
export { TurnContext };
// Quiet unused warning if buildSystemPrompt no longer used here directly.
void buildSystemPrompt;
