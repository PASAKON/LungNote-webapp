import "server-only";
import type { ChatMessage } from "./types";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_OUTPUT_TOKENS = 300;

// Approximate Gemini 2.5 Flash list pricing (USD per 1M tokens).
// Verify at https://openrouter.ai/google/gemini-2.5-flash before relying on it.
const PRICE_INPUT_PER_M = 0.075;
const PRICE_OUTPUT_PER_M = 0.30;

export type ChatCompletionResult = {
  text: string;
  model: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  costEstimate: number;
};

export class AIClientError extends Error {
  constructor(message: string, readonly status?: number, readonly cause?: unknown) {
    super(message);
    this.name = "AIClientError";
  }
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: { model?: string; timeoutMs?: number } = {},
): Promise<ChatCompletionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new AIClientError("OPENROUTER_API_KEY missing");

  const model = options.model ?? DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const start = Date.now();

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://lungnote.com",
        "X-Title": "LungNote LINE Bot",
      },
      body: JSON.stringify({ model, messages, max_tokens: MAX_OUTPUT_TOKENS }),
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    throw new AIClientError(
      isTimeout ? `OpenRouter request timed out after ${timeoutMs}ms` : "OpenRouter network error",
      undefined,
      err,
    );
  }

  const latencyMs = Date.now() - start;

  if (!res.ok) {
    throw new AIClientError(`OpenRouter HTTP ${res.status}: ${await res.text()}`, res.status);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new AIClientError("OpenRouter returned empty content");

  const tokensIn = data.usage?.prompt_tokens ?? 0;
  const tokensOut = data.usage?.completion_tokens ?? 0;
  const costEstimate =
    (tokensIn * PRICE_INPUT_PER_M + tokensOut * PRICE_OUTPUT_PER_M) / 1_000_000;

  return { text, model, latencyMs, tokensIn, tokensOut, costEstimate };
}
