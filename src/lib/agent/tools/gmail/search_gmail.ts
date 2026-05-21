import "server-only";
import { z } from "zod";
import {
  loadActiveGmailConnection,
  withFreshAccessToken,
} from "@/lib/gmail/agent-helpers";
import {
  findHeader,
  getMessageMetadata,
  listInboxMessages,
  truncateFromHeader,
} from "@/lib/gmail/client";
import type { AgentTool } from "../../tool";

const FETCH_METADATA_CONCURRENCY = 5;

const args = z
  .object({
    query: z
      .string()
      .min(1)
      .max(200)
      .describe(
        "Gmail search query. Common operators: from:, to:, subject:, " +
          "after:YYYY/MM/DD, before:, newer_than:1d, has:attachment, " +
          "is:unread, label:INBOX. Combine with AND/OR.",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(10)
      .describe("Max messages to return (default 10, hard cap 20)."),
  })
  .strict();

export const searchGmailTool: AgentTool<z.infer<typeof args>> = {
  name: "search_gmail",
  category: "gmail",
  description:
    "Search the user's Gmail inbox by query. Returns matching messages " +
    "with from/subject/snippet/date so the model can decide which to " +
    "convert to todos via save_email_as_todo. Use when user asks to find " +
    "specific emails or list emails from sender/date range.",
  schema: args,
  requires: ["linked", "gmail_connected"],
  async execute({ query, limit }, ctx) {
    if (!ctx.lineUserId) return { ok: false, reason: "not_linked" };
    const conn = await loadActiveGmailConnection(ctx.lineUserId);
    if (!conn) return { ok: false, reason: "gmail_not_connected" };

    let accessToken: string;
    try {
      ({ accessToken } = await withFreshAccessToken(conn));
    } catch (err) {
      return {
        ok: false,
        reason: "token_refresh_failed",
        error: err instanceof Error ? err.message : String(err),
      };
    }

    let list;
    try {
      list = await listInboxMessages(accessToken, {
        q: query,
        maxResults: limit,
      });
    } catch (err) {
      return {
        ok: false,
        reason: "gmail_search_failed",
        error: err instanceof Error ? err.message : String(err),
      };
    }

    const ids = (list.messages ?? []).map((m) => m.id);
    if (ids.length === 0) {
      return { ok: true, count: 0, results: [] };
    }

    const metaArr = await fetchAllMetadata(accessToken, ids);

    return {
      ok: true,
      count: metaArr.length,
      results: metaArr.map((m) => {
        const headers = m.payload.headers;
        return {
          message_id: m.id,
          thread_id: m.threadId,
          from: truncateFromHeader(findHeader(headers, "From") ?? ""),
          subject: (findHeader(headers, "Subject") ?? "").slice(0, 200),
          snippet: (m.snippet ?? "").slice(0, 300),
          date: new Date(Number(m.internalDate) || 0).toISOString(),
        };
      }),
    };
  },
};

async function fetchAllMetadata(
  accessToken: string,
  ids: string[],
): Promise<Awaited<ReturnType<typeof getMessageMetadata>>[]> {
  const out: Awaited<ReturnType<typeof getMessageMetadata>>[] = [];
  const queue = [...ids];
  await Promise.all(
    Array.from(
      { length: Math.min(FETCH_METADATA_CONCURRENCY, queue.length) },
      async () => {
        while (queue.length) {
          const id = queue.shift();
          if (!id) break;
          try {
            out.push(await getMessageMetadata(accessToken, id));
          } catch {
            /* skip unfetchable */
          }
        }
      },
    ),
  );
  return out;
}
