export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

/** Metadata returned alongside a successful AI reply. */
export type AIReplyMeta = {
  model: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  costEstimate: number; // USD
};

/** Result of one AI reply attempt. Discriminated union. */
export type AIReplyResult =
  | { ok: true; text: string; meta: AIReplyMeta }
  | { ok: false; reason: "rate_limited" | "ai_error" | "ai_timeout" | "ai_empty"; error?: string };
