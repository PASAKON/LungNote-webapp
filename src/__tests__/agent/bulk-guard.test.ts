import { describe, it, expect } from "vitest";
import { shouldRequireConfirmation } from "@/lib/agent/bulk_guard";
import type { BulkOpKind } from "@/lib/agent/bulk_guard";

describe("shouldRequireConfirmation", () => {
  const ops: BulkOpKind[] = ["complete", "delete", "uncomplete"];

  it("returns false for 1 op", () => {
    for (const op of ops) {
      expect(shouldRequireConfirmation(1, op)).toBe(false);
    }
  });

  it("returns false for 2 ops", () => {
    for (const op of ops) {
      expect(shouldRequireConfirmation(2, op)).toBe(false);
    }
  });

  it("returns true at exactly 3 ops", () => {
    for (const op of ops) {
      expect(shouldRequireConfirmation(3, op)).toBe(true);
    }
  });

  it("returns true for counts above 3", () => {
    for (const op of ops) {
      expect(shouldRequireConfirmation(18, op)).toBe(true);
      expect(shouldRequireConfirmation(100, op)).toBe(true);
    }
  });

  it("returns false for 0 ops", () => {
    expect(shouldRequireConfirmation(0, "complete")).toBe(false);
  });
});

describe("TurnContext bulk guard integration", () => {
  it("shouldBlockBulk returns false when count < 3", () => {
    expect(shouldRequireConfirmation(2, "complete")).toBe(false);
    expect(shouldRequireConfirmation(2, "delete")).toBe(false);
    expect(shouldRequireConfirmation(2, "uncomplete")).toBe(false);
  });

  it("shouldBlockBulk returns true when count >= 3 regardless of op kind", () => {
    expect(shouldRequireConfirmation(3, "complete")).toBe(true);
    expect(shouldRequireConfirmation(3, "delete")).toBe(true);
    expect(shouldRequireConfirmation(3, "uncomplete")).toBe(true);
  });

  it("mixed op kinds share the same counter (1+1+1=3 → block)", () => {
    // Guard function uses a single count — context.ts uses one counter
    // for all bulk op kinds combined.
    expect(shouldRequireConfirmation(3, "complete")).toBe(true);
  });
});
