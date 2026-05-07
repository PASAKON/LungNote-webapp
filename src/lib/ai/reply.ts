import "server-only";
import { chatCompletion, AIClientError } from "./client";
import { buildPromptMessages } from "./prompts";
import type { AIReplyResult } from "./types";

/**
 * Generate an AI reply for a single user message.
 *
 * v0: stateless. No conversation memory, no rate limiting, no audit logging —
 * those are added in v1 once Supabase is wired up.
 *
 * @param lineUserId - LINE user ID (unused in v0; reserved for v1 memory/rate-limit).
 * @param userText - The user's message text.
 */
export async function generateChatReply(
  lineUserId: string,
  userText: string,
): Promise<AIReplyResult> {
  // Suppress "unused parameter" warning while keeping the v1-compatible signature.
  void lineUserId;

  const messages = buildPromptMessages([], userText);

  try {
    const result = await chatCompletion(messages);
    return {
      ok: true,
      text: result.text,
      meta: {
        model: result.model,
        latencyMs: result.latencyMs,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        costEstimate: result.costEstimate,
      },
    };
  } catch (err) {
    const isTimeout =
      err instanceof AIClientError && /timed out/i.test(err.message);
    const reason = isTimeout ? "ai_timeout" : "ai_error";
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, reason, error };
  }
}
