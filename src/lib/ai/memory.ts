import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ChatMessage } from "./types";

const MAX_MEMORY_ENTRIES = 20; // 10 user + 10 assistant
const COMPACT_THRESHOLD = 10;

export function trimMemory(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_MEMORY_ENTRIES) return messages;
  return messages.slice(-MAX_MEMORY_ENTRIES);
}

/**
 * When stored count exceeds COMPACT_THRESHOLD, fold oldest entries into a
 * single system summary message so the model retains context without
 * ballooning the prompt. Keeps the most recent COMPACT_THRESHOLD entries
 * verbatim.
 */
export function compactOldEntries(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= COMPACT_THRESHOLD) return messages;
  const oldCount = messages.length - COMPACT_THRESHOLD;
  const oldest = messages.slice(0, oldCount);
  const recent = messages.slice(oldCount);
  const joined = oldest.map((m) => `${m.role}: ${m.content}`).join("\n");
  const summary: ChatMessage = {
    role: "system",
    content: `[Previous conversation summary]\n${joined.slice(0, 1500)}`,
  };
  return [summary, ...recent];
}

/**
 * Numbered-list reply pattern (3+ "1. text" lines). When the assistant
 * replies with a list of pending todos, we DON'T want to keep the raw
 * items in conversation memory: next turn the model would reuse those
 * line numbers as if they were still valid, leading to "ลบ 5 6" bugs
 * where the model lists 6 stale items and the user picks a position
 * that doesn't exist in the live DB.
 *
 * Replace such replies with a placeholder so the model knows a list
 * happened but cannot recite items from memory — forcing it to call
 * list_pending fresh.
 */
const NUMBERED_LINE_RE = /^\s*\d+\.\s+\S/;

export function summarizeListReply(text: string): string {
  if (!text) return text;
  const lines = text.split(/\r?\n/);
  const numbered = lines.filter((l) => NUMBERED_LINE_RE.test(l));
  if (numbered.length >= 3) {
    return `[เคย list ${numbered.length} รายการ — call list_pending ใหม่ถ้าต้องอ้างอิง]`;
  }
  return text;
}

export function mergeAndTrim(
  prior: ChatMessage[],
  newUser: string,
  newAssistant: string,
): ChatMessage[] {
  const appended: ChatMessage[] = [
    ...prior,
    { role: "user", content: newUser },
    { role: "assistant", content: summarizeListReply(newAssistant) },
  ];
  return trimMemory(compactOldEntries(appended));
}

/**
 * Load the rolling memory window for one LINE user.
 * Best-effort: errors are logged and treated as empty memory.
 */
export async function loadMemory(lineUserId: string): Promise<ChatMessage[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("lungnote_conversation_memory")
    .select("messages")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (error) {
    console.error("loadMemory error", { lineUserId, error: error.message });
    return [];
  }

  const raw = (data?.messages as ChatMessage[] | null) ?? [];
  return Array.isArray(raw) ? trimMemory(raw) : [];
}

/**
 * Append the new user/assistant exchange and persist (compacted then trimmed to 20).
 * Best-effort: errors are logged but not thrown — the user already got their reply.
 */
export async function saveMemory(
  lineUserId: string,
  prior: ChatMessage[],
  newUser: string,
  newAssistant: string,
  toolSummary?: string,
): Promise<void> {
  const sb = createAdminClient();
  const next = mergeAndTrim(prior, newUser, newAssistant);

  if (toolSummary) {
    const lastIdx = next.length - 1;
    const last = next[lastIdx];
    if (last?.role === "assistant") {
      next[lastIdx] = { ...last, tool_summary: toolSummary };
    }
  }

  const { error } = await sb
    .from("lungnote_conversation_memory")
    .upsert(
      {
        line_user_id: lineUserId,
        messages: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "line_user_id" },
    );

  if (error) {
    console.error("saveMemory error", { lineUserId, error: error.message });
  }
}
