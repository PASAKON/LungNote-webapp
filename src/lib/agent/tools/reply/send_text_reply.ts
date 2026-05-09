import "server-only";
import { z } from "zod";
import { TurnContext } from "../../context";
import type { AgentTool } from "../../tool";

const args = z.object({
  text: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "One LINE chat bubble. Keep under ~300 chars. Call multiple times for multi-bubble replies (max 5 per turn).",
    ),
});

/**
 * Multi-bubble reply tool — adopted from ClaudeFlow's Lunar agent.
 *
 * Use this ONLY when you want to send 2+ separate chat bubbles
 * (e.g. confirmation + tip, link + instructions). For single-bubble
 * replies, just output text normally — the runtime sends that as one
 * bubble. LINE caps a reply at 5 messages per call; pushing past that
 * returns ok:false so the model can stop.
 *
 * Why a tool not a string: trace records each bubble independently,
 * and the model can interleave bubbles with other tool calls (e.g.
 * list_pending → send_text_reply summary → send_text_reply tip).
 */
export const sendTextReplyTool: AgentTool<z.infer<typeof args>> = {
  name: "send_text_reply",
  category: "reply",
  description:
    "Send one chat bubble to the user. Call MULTIPLE times for multi-bubble replies — e.g. one bubble for confirmation, another for a tip or link. Max 5 bubbles per turn. Skip this tool entirely if your reply fits in one bubble; just output text normally.",
  schema: args,
  async execute(input, ctx) {
    const r = ctx.pushReply(input.text);
    if (!r.ok) {
      return {
        ok: false,
        reason: r.reason ?? "push_failed",
        message: `Bubble limit ${TurnContext.MAX_BUBBLES} reached this turn. Stop calling send_text_reply.`,
      };
    }
    return {
      ok: true,
      bubble_index: ctx.getReplyBubbles().length,
      remaining: TurnContext.MAX_BUBBLES - ctx.getReplyBubbles().length,
    };
  },
};
