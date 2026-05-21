import "server-only";
import { z } from "zod";
import {
  loadActiveGmailConnection,
} from "@/lib/gmail/agent-helpers";
import { syncForUser } from "@/lib/gmail/sync";
import type { AgentTool } from "../../tool";

const args = z.object({}).strict();

export const scanGmailNowTool: AgentTool<z.infer<typeof args>> = {
  name: "scan_gmail_now",
  category: "gmail",
  description:
    "Pull recent INBOX messages, run the AI classifier (urgent / needs " +
    "reply), and save matches as todos. First call after Connect fetches " +
    "the last 24h (cap 50). Subsequent calls use the Gmail historyId " +
    "cursor. Use when user asks for a bulk catch-up scan — for narrow " +
    "search use search_gmail + save_email_as_todo instead.",
  schema: args,
  requires: ["linked", "gmail_connected"],
  async execute(_input, ctx) {
    if (!ctx.lineUserId) return { ok: false, reason: "not_linked" };
    const conn = await loadActiveGmailConnection(ctx.lineUserId);
    if (!conn) return { ok: false, reason: "gmail_not_connected" };

    try {
      const result = await syncForUser(conn.userId);
      if (!result) {
        return { ok: false, reason: "no_active_connection" };
      }
      return {
        ok: true,
        scanned: result.scanned,
        todos_created: result.todosCreated,
        skipped: result.skipped,
        error: result.error,
      };
    } catch (err) {
      return {
        ok: false,
        reason: "scan_failed",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
