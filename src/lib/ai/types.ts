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
  /**
   * Why the intent router (see `lib/agent/router.ts`) picked this turn's
   * model. Recorded in the trace meta so the admin viewer can show a
   * "default" vs "update_verb" / "profile_fact" pill per row.
   */
  routeReason?: string;
};

/** Result of one AI reply attempt. Discriminated union. */
export type AIReplyResult =
  | { ok: true; text: string; meta: AIReplyMeta }
  | { ok: false; reason: "rate_limited" | "ai_error" | "ai_timeout" | "ai_empty"; error?: string };
