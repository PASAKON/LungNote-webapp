/**
 * Eval-side model factory.
 *
 * Mirrors the resolution logic in `src/lib/agent/model.ts` minus the
 * `server-only` import, so the eval runner (executed via `tsx` outside
 * Next.js) can instantiate either an Anthropic-direct or OpenRouter
 * passthrough model with the same caching / pricing characteristics
 * as production.
 *
 * Why duplicate instead of reuse: `model.ts` ships with `import
 * "server-only"`, which throws when imported under tsx. We accept the
 * minor drift in exchange for clean separation between prod runtime
 * and eval harness — if pricing or provider routing changes, both
 * files need updating, and the diff is obvious.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

export type EvalModel = {
  provider: "anthropic" | "openrouter";
  modelId: string;
  model: LanguageModel;
  supportsCache: boolean;
  cacheProviderKey: "anthropic" | "openrouter" | null;
  priceInputPerM: number;
  priceOutputPerM: number;
};

const PRICING: Record<string, { in: number; out: number }> = {
  "anthropic/claude-sonnet-4-5": { in: 3.0, out: 15.0 },
  "anthropic/claude-sonnet-4-6": { in: 3.0, out: 15.0 },
  "anthropic/claude-haiku-4-5": { in: 0.8, out: 4.0 },
  "google/gemini-2.5-flash": { in: 0.075, out: 0.3 },
  "google/gemini-2.5-flash-lite": { in: 0.0375, out: 0.15 },
  "openai/gpt-5": { in: 5.0, out: 15.0 },
};

export function resolveEvalModel(modelId: string): EvalModel {
  const isAnthropic = modelId.startsWith("anthropic/");
  const price = PRICING[modelId] ?? { in: 1.0, out: 5.0 };

  if (isAnthropic && process.env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const bareId = modelId.replace(/^anthropic\//, "");
    return {
      provider: "anthropic",
      modelId,
      model: anthropic(bareId),
      supportsCache: true,
      cacheProviderKey: "anthropic",
      priceInputPerM: price.in,
      priceOutputPerM: price.out,
    };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "neither ANTHROPIC_API_KEY nor OPENROUTER_API_KEY is set — cannot resolve model",
    );
  }
  const openrouter = createOpenRouter({ apiKey });
  return {
    provider: "openrouter",
    modelId,
    model: openrouter.chat(modelId, { usage: { include: true } }),
    supportsCache: isAnthropic,
    cacheProviderKey: isAnthropic ? "openrouter" : null,
    priceInputPerM: price.in,
    priceOutputPerM: price.out,
  };
}
