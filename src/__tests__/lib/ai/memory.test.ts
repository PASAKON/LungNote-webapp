import { describe, it, expect } from "vitest";
import { trimMemory, mergeAndTrim } from "@/lib/ai/memory";

describe("trimMemory", () => {
  it("returns input unchanged when ≤ 10 entries", () => {
    const m = Array.from({ length: 6 }, (_, i) => ({
      role: "user" as const,
      content: `m${i}`,
    }));
    expect(trimMemory(m)).toEqual(m);
  });

  it("keeps only the last 10 entries", () => {
    const m = Array.from({ length: 15 }, (_, i) => ({
      role: "user" as const,
      content: `m${i}`,
    }));
    const out = trimMemory(m);
    expect(out).toHaveLength(10);
    expect(out[0].content).toBe("m5");
    expect(out[9].content).toBe("m14");
  });
});

describe("mergeAndTrim", () => {
  it("appends user + assistant and trims to last 10", () => {
    const prior = Array.from({ length: 9 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `p${i}`,
    }));
    const out = mergeAndTrim(prior, "new-user", "new-assistant");
    expect(out).toHaveLength(10);
    expect(out[8].content).toBe("new-user");
    expect(out[9].content).toBe("new-assistant");
    // First "p0" was dropped because we appended 2 and trimmed to 10.
    expect(out[0].content).toBe("p1");
  });

  it("works with empty prior", () => {
    const out = mergeAndTrim([], "first", "reply");
    expect(out).toEqual([
      { role: "user", content: "first" },
      { role: "assistant", content: "reply" },
    ]);
  });
});
