import { describe, it, expect } from "vitest";
import {
  trimMemory,
  mergeAndTrim,
  compactOldEntries,
} from "@/lib/ai/memory";
import type { ChatMessage } from "@/lib/ai/types";

describe("compactOldEntries", () => {
  it("returns unchanged when ≤ 10 entries", () => {
    const m: ChatMessage[] = Array.from({ length: 8 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `m${i}`,
    }));
    expect(compactOldEntries(m)).toEqual(m);
  });

  it("folds oldest entries into single system summary when > 10", () => {
    const m: ChatMessage[] = Array.from({ length: 13 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `m${i}`,
    }));
    const out = compactOldEntries(m);
    // 13 → fold 3 oldest into 1 summary; keep 10 recent → 11 total
    expect(out).toHaveLength(11);
    expect(out[0].role).toBe("system");
    expect(out[0].content.startsWith("[Previous conversation summary]")).toBe(
      true,
    );
    // Recent 10 are preserved verbatim
    expect(out[1].content).toBe("m3");
    expect(out[10].content).toBe("m12");
  });

  it("summary body stays under 1500 chars even with huge old block", () => {
    const m: ChatMessage[] = Array.from({ length: 30 }, (_, i) => ({
      role: "user",
      content: "x".repeat(200),
    }));
    const out = compactOldEntries(m);
    expect(out[0].role).toBe("system");
    const body = out[0].content.replace(
      /^\[Previous conversation summary\]\n/,
      "",
    );
    expect(body.length).toBeLessThanOrEqual(1500);
  });
});

describe("mergeAndTrim integration with compaction", () => {
  it("compacts when prior + new exceeds 10", () => {
    const prior: ChatMessage[] = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `p${i}`,
    }));
    const out = mergeAndTrim(prior, "u-new", "a-new");
    // 10 + 2 = 12 → compact 2 oldest into summary → 11
    expect(out).toHaveLength(11);
    expect(out[0].role).toBe("system");
    expect(out[out.length - 1].content).toBe("a-new");
  });

  it("does NOT exceed hard ceiling of 20", () => {
    const huge: ChatMessage[] = Array.from({ length: 50 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `h${i}`,
    }));
    const out = mergeAndTrim(huge, "u-new", "a-new");
    expect(out.length).toBeLessThanOrEqual(20);
  });
});

describe("trimMemory hard cap", () => {
  it("caps at 20 even when caller skips compaction", () => {
    const m: ChatMessage[] = Array.from({ length: 50 }, (_, i) => ({
      role: "user",
      content: `m${i}`,
    }));
    const out = trimMemory(m);
    expect(out).toHaveLength(20);
  });
});

describe("ChatMessage backward compatibility", () => {
  it("loads legacy messages without tool_summary", () => {
    const legacy: ChatMessage[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "ok" },
    ];
    expect(trimMemory(legacy)).toEqual(legacy);
    expect(legacy[1].tool_summary).toBeUndefined();
  });

  it("preserves tool_summary on assistant messages through trim", () => {
    const m: ChatMessage[] = [
      { role: "user", content: "do" },
      { role: "assistant", content: "done", tool_summary: "[tools] save×2" },
    ];
    const out = trimMemory(m);
    expect(out[1].tool_summary).toBe("[tools] save×2");
  });
});
