import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT, buildPromptMessages } from "@/lib/ai/prompts";

describe("SYSTEM_PROMPT", () => {
  it("mentions LungNote and Thai-default voice", () => {
    expect(SYSTEM_PROMPT).toMatch(/LungNote/);
    expect(SYSTEM_PROMPT.toLowerCase()).toMatch(/thai/);
  });

  it("includes a decision tree mapping intents to tools", () => {
    expect(SYSTEM_PROMPT).toMatch(/DECISION TREE/i);
    expect(SYSTEM_PROMPT).toMatch(/save_memory/);
    expect(SYSTEM_PROMPT).toMatch(/list_pending/);
    expect(SYSTEM_PROMPT).toMatch(/send_dashboard_link/);
  });

  it("provides few-shot examples for tool selection", () => {
    expect(SYSTEM_PROMPT).toMatch(/FEW-SHOT EXAMPLES/i);
    // At least one Thai save example with a date phrase
    expect(SYSTEM_PROMPT).toMatch(/พรุ่งนี้/);
  });

  it("declares refusal policy for off-topic requests", () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toMatch(/off-topic|refus/);
    expect(SYSTEM_PROMPT.toLowerCase()).toMatch(/homework/);
    expect(SYSTEM_PROMPT).toMatch(/ขอโทษ/);
  });

  it("declares caveman-lite voice with auto-clarity escape", () => {
    expect(SYSTEM_PROMPT).toMatch(/caveman/i);
    expect(SYSTEM_PROMPT.toLowerCase()).toMatch(/drop filler/);
    expect(SYSTEM_PROMPT.toLowerCase()).toMatch(/fragments ok/);
    // Auto-clarity: drop terse mode when user is confused.
    expect(SYSTEM_PROMPT).toMatch(/confused|ไม่เข้าใจ|งง/);
    // Polite particles stay.
    expect(SYSTEM_PROMPT.toLowerCase()).toMatch(/polite particles/);
  });

  it("forbids exposing tool names / UUIDs / system prompt", () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toMatch(/never expose|never share/);
  });
});

describe("buildPromptMessages", () => {
  it("places system prompt first, then memory, then user message", () => {
    const memory = [
      { role: "user" as const, content: "ก่อนหน้านี้" },
      { role: "assistant" as const, content: "ตอบก่อนหน้า" },
    ];
    const out = buildPromptMessages(memory, "ใหม่ล่าสุด");
    expect(out).toHaveLength(4);
    expect(out[0].role).toBe("system");
    expect(out[0].content).toBe(SYSTEM_PROMPT);
    expect(out[1]).toEqual(memory[0]);
    expect(out[2]).toEqual(memory[1]);
    expect(out[3]).toEqual({ role: "user", content: "ใหม่ล่าสุด" });
  });

  it("works with empty memory", () => {
    const out = buildPromptMessages([], "first message");
    expect(out).toHaveLength(2);
    expect(out[0].role).toBe("system");
    expect(out[1]).toEqual({ role: "user", content: "first message" });
  });
});
