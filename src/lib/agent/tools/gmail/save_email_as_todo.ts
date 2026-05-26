import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  classifyEmailsForTodo,
  type ClassifiedAction,
} from "@/lib/ai/email-classify";
import {
  loadActiveGmailConnection,
  withFreshAccessToken,
} from "@/lib/gmail/agent-helpers";
import {
  findHeader,
  getMessageMetadata,
  permalinkFor,
  truncateFromHeader,
} from "@/lib/gmail/client";
import type { AgentTool } from "../../tool";

const INBOX_TITLE = "📥 Inbox";

const args = z
  .object({
    message_id: z
      .string()
      .min(1)
      .max(200)
      .describe("Gmail message id from search_gmail results."),
    text: z
      .string()
      .min(1)
      .max(160)
      .optional()
      .describe(
        "Override the auto-extracted todo title. Leave empty to let the " +
          "AI classifier derive it from subject + snippet.",
      ),
    due_at: z
      .string()
      .datetime()
      .nullable()
      .optional()
      .describe("Override due_at (ISO timestamp). null = no due date."),
  })
  .strict();

export const saveEmailAsTodoTool: AgentTool<z.infer<typeof args>> = {
  name: "save_email_as_todo",
  category: "gmail",
  description:
    "Convert a specific Gmail message to a LungNote todo. Call AFTER " +
    "search_gmail when user picks an email to save. The server fetches " +
    "metadata, optionally runs the classifier to extract text + due_at, " +
    "then inserts into the user's Inbox note with source='email'. " +
    "Idempotent — re-saving the same message returns existing todo_id.",
  schema: args,
  requires: ["linked", "gmail_connected"],
  async execute({ message_id, text, due_at }, ctx) {
    if (!ctx.lineUserId) return { ok: false, reason: "not_linked" };
    const conn = await loadActiveGmailConnection(ctx.lineUserId);
    if (!conn) return { ok: false, reason: "gmail_not_connected" };

    const sb = createAdminClient();

    // Idempotency: if a todo already exists for (user_id, source='email',
    // message_id), return it without re-calling Gmail.
    const { data: existing } = await sb
      .from("lungnote_todos")
      .select("id, text, due_at")
      .eq("user_id", conn.userId)
      .eq("source", "email")
      .eq("source_external_id", message_id)
      .maybeSingle();
    if (existing?.id) {
      return {
        ok: true,
        already_saved: true,
        todo_id: existing.id,
        text: existing.text,
        due_at: existing.due_at,
      };
    }

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

    let meta;
    try {
      meta = await getMessageMetadata(accessToken, message_id);
    } catch (err) {
      return {
        ok: false,
        reason: "gmail_fetch_failed",
        error: err instanceof Error ? err.message : String(err),
      };
    }

    const headers = meta.payload.headers;
    const fromRaw = findHeader(headers, "From") ?? "";
    const subjectRaw = findHeader(headers, "Subject") ?? "";
    const internalDateIso = new Date(
      Number(meta.internalDate) || 0,
    ).toISOString();

    let finalText = text?.trim();
    let finalDueAt: string | null = due_at ?? null;
    let finalDueText: string | null = null;
    let aiReason = "user_explicit";
    let suggestedActions: ClassifiedAction[] = [];

    if (!finalText) {
      try {
        const [c] = await classifyEmailsForTodo([
          {
            message_id,
            from: truncateFromHeader(fromRaw),
            subject: subjectRaw,
            snippet: meta.snippet ?? "",
            internal_date: internalDateIso,
          },
        ]);
        finalText = c.text?.trim() || subjectRaw.slice(0, 160) || "(no subject)";
        if (due_at === undefined) finalDueAt = c.due_at;
        finalDueText = c.due_text;
        aiReason = c.reason.slice(0, 200);
        suggestedActions = c.actions;
      } catch {
        finalText = subjectRaw.slice(0, 160) || "(no subject)";
      }
    }

    const inboxId = await ensureInboxNote(conn.userId);
    if (!inboxId) {
      return { ok: false, reason: "inbox_create_failed" };
    }

    const { data: todo, error: todoErr } = await sb
      .from("lungnote_todos")
      .insert({
        user_id: conn.userId,
        note_id: inboxId,
        text: finalText.slice(0, 2000),
        due_at: finalDueAt,
        due_text: finalDueText,
        source: "email",
        source_external_id: message_id,
        source_url: permalinkFor(meta.threadId),
      })
      .select("id")
      .single();

    if (todoErr || !todo) {
      // Unique-violation = double save race; re-fetch
      const { data: race } = await sb
        .from("lungnote_todos")
        .select("id, text, due_at")
        .eq("user_id", conn.userId)
        .eq("source", "email")
        .eq("source_external_id", message_id)
        .maybeSingle();
      if (race?.id) {
        return {
          ok: true,
          already_saved: true,
          todo_id: race.id,
          text: race.text,
          due_at: race.due_at,
        };
      }
      return {
        ok: false,
        reason: "todo_insert_failed",
        error: todoErr?.message ?? "unknown",
      };
    }

    await sb.from("lungnote_gmail_synced_messages").upsert(
      {
        user_id: conn.userId,
        connection_id: conn.snapshot.id,
        message_id,
        thread_id: meta.threadId,
        internal_date: internalDateIso,
        from_truncated: truncateFromHeader(fromRaw),
        subject_truncated: subjectRaw.slice(0, 80),
        is_todo: true,
        todo_id: todo.id,
        ai_reason: aiReason,
        suggested_actions: suggestedActions,
      },
      { onConflict: "user_id,message_id" },
    );

    return {
      ok: true,
      todo_id: todo.id,
      text: finalText,
      due_at: finalDueAt,
      due_text: finalDueText,
    };
  },
};

async function ensureInboxNote(userId: string): Promise<string | null> {
  const sb = createAdminClient();
  const { data: existing } = await sb
    .from("lungnote_notes")
    .select("id")
    .eq("user_id", userId)
    .eq("title", INBOX_TITLE)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created } = await sb
    .from("lungnote_notes")
    .insert({ user_id: userId, title: INBOX_TITLE, body: "" })
    .select("id")
    .single();
  return created?.id ?? null;
}
