import "server-only";
import { chatCompletion, AIClientError } from "./client";
import { buildPromptMessages } from "./prompts";
import { loadMemory, saveMemory } from "./memory";
import type { AIReplyResult } from "./types";

/**
 * Generate an AI reply for a single user message, using a rolling 5-user + 5-assistant
 * conversation memory window persisted in lungnote_conversation_memory.
 *
 * Memory load and save are best-effort: a DB outage degrades to a stateless reply
 * but never blocks the response to the user.
 *
 * @param lineUserId - LINE user ID; used as the memory key.
 * @param userText - The user's current message.
 */
export async function generateChatReply(
  lineUserId: string,
  userText: string,
): Promise<AIReplyResult> {
  const memory = await loadMemory(lineUserId);
  const messages = buildPromptMessages(memory, userText);

  try {
    const result = await chatCompletion(messages);

    // Best-effort memory save; do not block the reply on this.
    void saveMemory(lineUserId, memory, userText, result.text).catch((err: unknown) => {
      console.error("saveMemory rejected", { lineUserId, err });
    });

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
