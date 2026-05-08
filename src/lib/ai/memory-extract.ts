import "server-only";
import { chatCompletion } from "./client";
import type { ChatMessage } from "./types";

const MAX_TEXT_LENGTH = 2000;

/**
 * Memory extraction — ADR-0012.
 *
 * Pulls a clean todo `text`, an optional ISO `due_at`, and the raw natural-
 * language `due_text` (e.g. "พรุ่งนี้") out of a free-form user message.
 * The LLM is given the current local date so relative phrases ("พรุ่งนี้",
 * "วันพุธ", "อาทิตย์หน้า") can be resolved deterministically.
 *
 * Falls back to {text: trimmed, due_at: null, due_text: null} on any failure
 * so save flow never blocks on AI availability.
 */
export type MemoryExtraction = {
  text: string;
  due_at: string | null; // ISO timestamp (UTC)
  due_text: string | null; // raw phrase from user input
};

const TZ_OFFSET_HOURS = 7; // Asia/Bangkok — LungNote's primary audience

/** Format the reference date that the LLM should anchor relative phrases to. */
function buildPromptContext(now: Date): {
  isoDate: string;
  weekday: string;
  thaiDate: string;
} {
  // Convert "now" to Bangkok local for stable weekday/date strings.
  const bkk = new Date(now.getTime() + TZ_OFFSET_HOURS * 3600 * 1000);
  const isoDate = bkk.toISOString().slice(0, 10); // YYYY-MM-DD in BKK
  const weekday = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][bkk.getUTCDay()];
  const thaiDate = bkk.toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC", // we already shifted manually
  });
  return { isoDate, weekday, thaiDate };
}

function buildPrompt(now: Date): string {
  const { isoDate, weekday, thaiDate } = buildPromptContext(now);
  return `You extract reminder/todo info from a user's message.
Reply ONLY with valid JSON in the form
{"text":"...","due_at":"YYYY-MM-DDTHH:mm:00+07:00"|null,"due_text":"..."|null}.
No prose, no markdown, no code fence.

Today reference (Asia/Bangkok, UTC+07:00):
- ISO date: ${isoDate}
- Weekday: ${weekday}
- Thai: ${thaiDate}

Rules:
- "text": the cleaned action/reminder content. Strip leading prefixes like "จด ", "บันทึก ", "todo ", "ทำ ", "เตือน ", "note ", "save ". Strip the date/time phrase from text — it's already captured in due_text. Preserve the user's language (Thai stays Thai).
- "due_at": ISO timestamp WITH timezone offset +07:00. Resolve relative phrases against the reference date above:
    "วันนี้" / "today" → today
    "พรุ่งนี้" / "tomorrow" → today + 1
    "มะรืน" / "the day after tomorrow" → today + 2
    "วันจันทร์/อังคาร/พุธ/พฤหัส/ศุกร์/เสาร์/อาทิตย์" → next occurrence
    "อาทิตย์หน้า" / "next week" → 7 days later
    "เดือนหน้า" → 30 days later
    "<N> วัน" / "in N days" → today + N
    Specific dates like "15 พ.ย." → that date this year (or next year if past)
  Default time = 09:00 if user gives a date but no time.
  If the user gives a time only ("3 โมงเย็น", "5pm") with no date, assume today (or tomorrow if that time has already passed today).
  If no temporal phrase at all → null.
- "due_text": the EXACT phrase the user wrote that conveyed the time, e.g. "พรุ่งนี้", "วันพุธหน้า", "3 โมงเย็น". null if due_at is null.
- Never invent dates the user didn't imply.`;
}

export async function extractMemory(text: string): Promise<MemoryExtraction> {
  const trimmed = text.trim().slice(0, MAX_TEXT_LENGTH);
  if (!trimmed) return { text: "", due_at: null, due_text: null };

  const messages: ChatMessage[] = [
    { role: "system", content: buildPrompt(new Date()) },
    { role: "user", content: trimmed },
  ];

  try {
    const result = await chatCompletion(messages, { timeoutMs: 6_000 });
    const parsed = safeParseJson(result.text);
    if (parsed && typeof parsed.text === "string" && parsed.text.trim()) {
      const due_at = normalizeDueAt(parsed.due_at);
      return {
        text: parsed.text.trim().slice(0, MAX_TEXT_LENGTH),
        due_at,
        due_text:
          due_at && typeof parsed.due_text === "string" && parsed.due_text.trim()
            ? parsed.due_text.trim().slice(0, 200)
            : null,
      };
    }
  } catch {
    // fall through
  }

  return { text: trimmed, due_at: null, due_text: null };
}

function normalizeDueAt(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function safeParseJson(
  raw: string,
): { text?: unknown; due_at?: unknown; due_text?: unknown } | null {
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
