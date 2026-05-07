import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT, buildPromptMessages } from "@/lib/ai/prompts";

describe("SYSTEM_PROMPT", () => {
  it("mentions LungNote and Thai-default voice", () => {
    expect(SYSTEM_PROMPT).toMatch(/LungNote/);
    expect(SYSTEM_PROMPT.toLowerCase()).toMatch(/thai/);
  });

  it("declares note-taking-only scope and explicit refusal policy", () => {
    expect(SYSTEM_PROMPT).toMatch(/ALLOWED topics/i);
    expect(SYSTEM_PROMPT).toMatch(/REFUSE/i);
    // Off-scope examples we want the bot to deflect:
    expect(SYSTEM_PROMPT.toLowerCase()).toMatch(/programming/);
    expect(SYSTEM_PROMPT.toLowerCase()).toMatch(/homework|tutoring|trivia/);
  });

  it("provides Thai and English refusal templates", () => {
    expect(SYSTEM_PROMPT).toMatch(/ขอโทษ/);
    expect(SYSTEM_PROMPT).toMatch(/I can only help/i);
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
