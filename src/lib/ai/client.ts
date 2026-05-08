import "server-only";
import type { ChatMessage } from "./types";
import type { ToolCall } from "./tools";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_OUTPUT_TOKENS = 300;

// Approximate Gemini 2.5 Flash list pricing (USD per 1M tokens).
// Verify at https://openrouter.ai/google/gemini-2.5-flash before relying on it.
const PRICE_INPUT_PER_M = 0.075;
const PRICE_OUTPUT_PER_M = 0.30;

/**
 * Wire-format message used by OpenRouter / OpenAI-compatible endpoints.
 * Differs from our internal ChatMessage in that:
 *  - assistant turns may have null content + tool_calls
 *  - tool turns carry a tool_call_id back to the model
 */
export type WireMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: ToolCall[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ChatCompletionResult = {
  text: string;
  toolCalls: ToolCall[] | null;
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

/**
 * Send a chat completion request. Accepts either our simple ChatMessage[] or
 * the full wire-format messages (used in the agentic tool loop).
 */
export async function chatCompletion(
  messages: ChatMessage[] | WireMessage[],
  options: {
    model?: string;
    timeoutMs?: number;
    tools?: ToolDef[];
    toolChoice?: "auto" | "none";
  } = {},
): Promise<ChatCompletionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new AIClientError("OPENROUTER_API_KEY missing");

  const model = options.model ?? DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const start = Date.now();

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: MAX_OUTPUT_TOKENS,
  };
  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice ?? "auto";
  }

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
      body: JSON.stringify(body),
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
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: ToolCall[];
      };
    }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const message = data.choices?.[0]?.message;
  const text = (message?.content ?? "").trim();
  const toolCalls =
    message?.tool_calls && message.tool_calls.length > 0
      ? message.tool_calls
      : null;

  // It's valid to return text="" when toolCalls is set; only error on neither.
  if (!text && !toolCalls) {
    throw new AIClientError("OpenRouter returned empty content");
  }

  const tokensIn = data.usage?.prompt_tokens ?? 0;
  const tokensOut = data.usage?.completion_tokens ?? 0;
  const costEstimate =
    (tokensIn * PRICE_INPUT_PER_M + tokensOut * PRICE_OUTPUT_PER_M) / 1_000_000;

  return { text, toolCalls, model, latencyMs, tokensIn, tokensOut, costEstimate };
}
