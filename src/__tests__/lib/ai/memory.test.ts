import { describe, it, expect } from "vitest";
import { trimMemory, mergeAndTrim } from "@/lib/ai/memory";

describe("trimMemory", () => {
  it("returns input unchanged when ≤ 20 entries", () => {
    const m = Array.from({ length: 6 }, (_, i) => ({
      role: "user" as const,
      content: `m${i}`,
    }));
    expect(trimMemory(m)).toEqual(m);
  });

  it("keeps only the last 20 entries", () => {
    const m = Array.from({ length: 25 }, (_, i) => ({
      role: "user" as const,
      content: `m${i}`,
    }));
    const out = trimMemory(m);
    expect(out).toHaveLength(20);
    expect(out[0].content).toBe("m5");
    expect(out[19].content).toBe("m24");
  });
});

describe("mergeAndTrim", () => {
  it("appends user + assistant; under threshold returns verbatim", () => {
    const prior = Array.from({ length: 6 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `p${i}`,
    }));
    const out = mergeAndTrim(prior, "new-user", "new-assistant");
    // 6 prior + 2 appended = 8 ≤ COMPACT_THRESHOLD(10); no compaction.
    expect(out).toHaveLength(8);
    expect(out[6].content).toBe("new-user");
    expect(out[7].content).toBe("new-assistant");
    expect(out[0].content).toBe("p0");
  });

  it("works with empty prior", () => {
    const out = mergeAndTrim([], "first", "reply");
    expect(out).toEqual([
      { role: "user", content: "first" },
      { role: "assistant", content: "reply" },
    ]);
  });
});
