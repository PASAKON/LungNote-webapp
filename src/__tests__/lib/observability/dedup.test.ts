import { describe, it, expect, vi, beforeEach } from "vitest";

// Mutable mock state so each test sets the desired DB row.
const mockState = {
  row: null as
    | { reply_text: string | null; error_text: string | null }
    | null,
  error: null as string | null,
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: mockState.row,
                  error: mockState.error
                    ? { message: mockState.error }
                    : null,
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  }),
}));

import { checkAlreadyProcessed } from "@/lib/observability/dedup";

describe("checkAlreadyProcessed", () => {
  beforeEach(() => {
    mockState.row = null;
    mockState.error = null;
  });

  it("returns fresh when no prior trace exists", async () => {
    const r = await checkAlreadyProcessed("msg-abc");
    expect(r.status).toBe("fresh");
  });

  it("returns already_processed when trace has reply_text and no error", async () => {
    mockState.row = { reply_text: "บันทึกแล้ว ✓", error_text: null };
    const r = await checkAlreadyProcessed("msg-abc");
    expect(r.status).toBe("already_processed");
    if (r.status === "already_processed") {
      expect(r.replyText).toBe("บันทึกแล้ว ✓");
    }
  });

  it("returns fresh when prior trace had an error (we want to retry)", async () => {
    mockState.row = { reply_text: null, error_text: "ai_timeout" };
    const r = await checkAlreadyProcessed("msg-abc");
    expect(r.status).toBe("fresh");
  });

  it("returns fresh when reply_text exists but error_text also set (failed reply)", async () => {
    mockState.row = {
      reply_text: "...",
      error_text: "reply_failed: HTTP 400",
    };
    const r = await checkAlreadyProcessed("msg-abc");
    expect(r.status).toBe("fresh");
  });

  it("soft-fails on empty messageId", async () => {
    const r = await checkAlreadyProcessed("");
    expect(r.status).toBe("fresh");
  });

  it("soft-fails on DB error (treats as fresh — never block reply)", async () => {
    mockState.error = "boom";
    const r = await checkAlreadyProcessed("msg-abc");
    expect(r.status).toBe("fresh");
  });
});
