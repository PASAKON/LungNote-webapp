import "server-only";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * Model resolution. Reads LLM_MODEL env to decide both:
 *   - which provider to dial (Anthropic-direct vs OpenRouter passthrough)
 *   - which model id to send
 *
 * Default: Claude Sonnet 4.5 — strongest tool-calling + native prompt
 * caching. Override via env to swap to Gemini 2.5 Flash (cheaper, faster,
 * no caching, weaker on multi-step intent).
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
  "openai/gpt-5":                 { in: 5.0,    out: 15.0 },
};

export function resolveModel(): ResolvedModel {
  const id = (process.env.LLM_MODEL ?? "anthropic/claude-sonnet-4-5").trim();
  const isAnthropic = id.startsWith("anthropic/");

  const price = PRICING[id] ?? { in: 1.0, out: 5.0 };

  if (isAnthropic && process.env.ANTHROPIC_API_KEY) {
    // Direct Anthropic: native prompt cache via providerOptions.
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    const bareId = id.replace(/^anthropic\//, "");
    return {
      provider: "anthropic",
      modelId: id,
      model: anthropic(bareId),
      supportsCache: true,
      priceInputPerM: price.in,
      priceOutputPerM: price.out,
    };
  }

  // OpenRouter passthrough — works for any OpenRouter-listed model.
  // Anthropic models routed via OpenRouter still get auto-cache when prefix
  // is stable (no explicit cache_control needed), but we mark supportsCache
  // false so we don't emit anthropic-specific providerOptions on OpenRouter.
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "neither ANTHROPIC_API_KEY nor OPENROUTER_API_KEY is set — cannot resolve model",
    );
  }
  const openrouter = createOpenRouter({ apiKey });
  return {
    provider: "openrouter",
    modelId: id,
    model: openrouter.chat(id),
    supportsCache: false,
    priceInputPerM: price.in,
    priceOutputPerM: price.out,
  };
}
