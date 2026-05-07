import "server-only";
import { chatCompletion } from "./client";
import type { ChatMessage } from "./types";

const MAX_TITLE_LENGTH = 200;

const EXTRACT_PROMPT = `Extract a concise title and body from a user's note text.
Reply ONLY with valid JSON in the form {"title":"...","body":"..."}. No prose, no markdown, no code fence.

Rules:
- Title: ≤10 words, captures the main subject. Trim leading bullets/punctuation.
- Body: rest of the content. Empty string if the input is one short sentence.
- Preserve the user's language exactly (Thai input → Thai title and body; English → English).
- Do not invent details or expand the message.`;

export type NoteExtraction = {
  title: string;
  body: string;
};

/**
 * Extract a title + body from a free-form note text using the LLM.
 * Falls back to a deterministic split (first line as title) on any failure
 * so note creation never blocks on AI availability.
 */
export async function extractTitleBody(text: string): Promise<NoteExtraction> {
  const trimmed = text.trim();
  if (!trimmed) return { title: "", body: "" };

  const messages: ChatMessage[] = [
    { role: "system", content: EXTRACT_PROMPT },
    { role: "user", content: trimmed },
  ];

  try {
    const result = await chatCompletion(messages, { timeoutMs: 5_000 });
    const parsed = safeParseJson(result.text);
    if (
      parsed &&
      typeof parsed.title === "string" &&
      typeof parsed.body === "string" &&
      parsed.title.trim()
    ) {
      return {
        title: parsed.title.trim().slice(0, MAX_TITLE_LENGTH),
        body: parsed.body,
      };
    }
  } catch {
    // fall through to deterministic split
  }

  return fallbackSplit(trimmed);
}

export function fallbackSplit(text: string): NoteExtraction {
  const lines = text.split(/\r?\n/);
  const title = (lines[0] ?? "").trim().slice(0, MAX_TITLE_LENGTH);
  const body = lines.slice(1).join("\n").trim();
  return { title, body };
}

function safeParseJson(raw: string): { title?: unknown; body?: unknown } | null {
  // Strip optional ```json fences the model sometimes adds despite instructions.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}
