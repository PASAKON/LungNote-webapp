import "server-only";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * Model resolution. Reads LLM_MODEL env to decide both:
 *   - which provider to dial (Anthropic-direct vs OpenRouter passthrough)
 *   - which model id to send
 *
 * Default: Gemini 2.5 Flash — cheapest tier, fast, no native cache. Picked
 * for live cost trial. Known weaker on multi-step tool routing — flip back
 * to anthropic/claude-sonnet-4-5 (best tools, cache) or
 * anthropic/claude-haiku-4-5 (mid, cache) via env if tool-call reliability
 * degrades.
 *
 * Examples:
 *   LLM_MODEL=anthropic/claude-sonnet-4-5    → Anthropic direct (cache on)
 *   LLM_MODEL=anthropic/claude-haiku-4-5     → Anthropic direct
 *   LLM_MODEL=google/gemini-2.5-flash        → OpenRouter
 *   LLM_MODEL=openai/gpt-5                   → OpenRouter
 *
 * Pricing table approximates list rates per 1M tokens (USD).
 */
export type ResolvedModel = {
  /** Provider tag for trace/meta. */
  provider: "anthropic" | "openrouter";
  /** Model id as the user-facing ref (e.g. "anthropic/claude-sonnet-4-5"). */
  modelId: string;
  /** Vercel AI SDK LanguageModel handle. */
  model: LanguageModel;
  /** Whether to attach Anthropic prompt cache_control on system blocks. */
  supportsCache: boolean;
  /**
   * Provider key under which to nest cacheControl in providerOptions.
   * - "anthropic" — Anthropic-direct path
   * - "openrouter" — OpenRouter passthrough for anthropic/* models
   * - null — caching not supported (e.g. Gemini, GPT)
   */
  cacheProviderKey: "anthropic" | "openrouter" | null;
  /** Per-1M-token pricing for cost estimate in trace. */
  priceInputPerM: number;
  priceOutputPerM: number;
};

const PRICING: Record<string, { in: number; out: number }> = {
  "anthropic/claude-sonnet-4-5":  { in: 3.0,    out: 15.0 },
  "anthropic/claude-sonnet-4-6":  { in: 3.0,    out: 15.0 },
  "anthropic/claude-haiku-4-5":   { in: 0.8,    out: 4.0 },
  "google/gemini-2.5-flash":      { in: 0.075,  out: 0.3 },
  "google/gemini-2.5-flash-lite": { in: 0.0375, out: 0.15 },
  "google/gemini-2.5-pro":        { in: 1.25,   out: 10.0 },
  "openai/gpt-4o":                { in: 2.5,    out: 10.0 },
  "openai/gpt-4o-mini":           { in: 0.15,   out: 0.6 },
  "openai/gpt-5":                 { in: 5.0,    out: 15.0 },
};

/**
 * Resolve a model. Pass `modelOverride` to bypass the `LLM_MODEL` env
 * default — used by the intent router (`router.ts`) to escalate complex
 * turns to a stronger model while leaving the prod default unchanged.
 */
export function resolveModel(modelOverride?: string): ResolvedModel {
  const id = (modelOverride ?? process.env.LLM_MODEL ?? "google/gemini-2.5-flash").trim();
  const isAnthropic = id.startsWith("anthropic/");

  const price = PRICING[id] ?? { in: 1.0, out: 5.0 };

  if (isAnthropic && process.env.ANTHROPIC_API_KEY) {
    // Direct Anthropic: native prompt cache via providerOptions.anthropic.
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    const bareId = id.replace(/^anthropic\//, "");
    return {
      provider: "anthropic",
      modelId: id,
      model: anthropic(bareId),
      supportsCache: true,
      cacheProviderKey: "anthropic",
      priceInputPerM: price.in,
      priceOutputPerM: price.out,
    };
  }

  // OpenRouter passthrough — works for any OpenRouter-listed model.
  // For anthropic/* models, OpenRouter forwards Anthropic's cache_control
  // via providerOptions.openrouter.cacheControl (see @openrouter/ai-sdk-provider
  // README). Non-anthropic models on OpenRouter get no explicit cache.
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "neither ANTHROPIC_API_KEY nor OPENROUTER_API_KEY is set — cannot resolve model",
    );
  }
  const openrouter = createOpenRouter({ apiKey });
  // usage:{include:true} enables OpenRouter's usage accounting, which gives us
  // promptTokensDetails.cachedTokens (cache hit detection on anthropic/* via
  // OpenRouter). Per-call setting on chat(), not provider-level.
  return {
    provider: "openrouter",
    modelId: id,
    model: openrouter.chat(id, { usage: { include: true } }),
    supportsCache: isAnthropic,
    cacheProviderKey: isAnthropic ? "openrouter" : null,
    priceInputPerM: price.in,
    priceOutputPerM: price.out,
  };
}
