import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { buildToolSet } from "@/lib/agent/registry";
import { TurnContext } from "@/lib/agent/context";
import type { AgentTool } from "@/lib/agent/tool";
import { TraceCollector } from "@/lib/observability/trace";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: () => Promise.resolve({ error: null }),
    }),
  }),
}));

function makeCtx(lineUserId: string | null = "U-test"): TurnContext {
  const trace = new TraceCollector("trace-1", lineUserId ?? undefined, "test");
  return new TurnContext(lineUserId, trace);
}

describe("buildToolSet — preconditions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects 'linked' requirement when ctx has no lineUserId", async () => {
    const tool: AgentTool<{ x: string }> = {
      name: "needs_login",
      category: "auth",
      description: "x",
      schema: z.object({ x: z.string() }),
      requires: ["linked"],
      execute: async () => ({ ok: true }),
    };
    const ctx = makeCtx(null);
    const set = buildToolSet([tool], ctx);
    const result = await set.needs_login!.execute!(
      { x: "hi" },
      { toolCallId: "c1", messages: [] },
    );
    expect(result).toMatchObject({ ok: false, reason: "not_linked" });
  });

  it("rejects 'pending_listed' when no list cached", async () => {
    const tool: AgentTool<{ position: number }> = {
      name: "del",
      category: "memory",
      description: "x",
      schema: z.object({ position: z.number() }),
      requires: ["linked", "pending_listed"],
      execute: async () => ({ ok: true }),
    };
    const ctx = makeCtx();
    const set = buildToolSet([tool], ctx);
    const result = await set.del!.execute!(
      { position: 1 },
      { toolCallId: "c1", messages: [] },
    );
    expect(result).toMatchObject({
      ok: false,
      reason: "must_list_pending_first",
    });
  });

  it("passes preconditions and runs execute when satisfied", async () => {
    const tool: AgentTool<{ position: number }> = {
      name: "del",
      category: "memory",
      description: "x",
      schema: z.object({ position: z.number() }),
      requires: ["linked", "pending_listed"],
      execute: async () => ({ ok: true, todoId: "ok" }),
    };
    const ctx = makeCtx();
    ctx.setPendingList([
      { id: "abc", text: "a", due_at: null, due_text: null, created_at: "" },
    ]);
    const set = buildToolSet([tool], ctx);
    const result = await set.del!.execute!(
      { position: 1 },
      { toolCallId: "c1", messages: [] },
    );
    expect(result).toMatchObject({ ok: true, todoId: "ok" });
  });

  it("records tool call in trace regardless of outcome", async () => {
    const tool: AgentTool<Record<string, never>> = {
      name: "boom",
      category: "system",
      description: "x",
      schema: z.object({}).strict(),
      execute: async () => {
        throw new Error("kaboom");
      },
    };
    const ctx = makeCtx();
    const recordSpy = vi.spyOn(ctx.trace, "recordTool");
    const set = buildToolSet([tool], ctx);
    const result = await set.boom!.execute!(
      {},
      { toolCallId: "c1", messages: [] },
    );
    expect(result).toMatchObject({ ok: false, reason: "execution_error" });
    expect(recordSpy).toHaveBeenCalledWith(
      "boom",
      expect.anything(),
      expect.objectContaining({ ok: false, reason: "execution_error" }),
    );
  });
});

describe("TurnContext", () => {
  it("resolves position to item, returns null on out-of-range", () => {
    const ctx = makeCtx();
    ctx.setPendingList([
      { id: "a", text: "X", due_at: null, due_text: null, created_at: "" },
      { id: "b", text: "Y", due_at: null, due_text: null, created_at: "" },
    ]);
    expect(ctx.getPendingByPosition(1)?.id).toBe("a");
    expect(ctx.getPendingByPosition(2)?.id).toBe("b");
    expect(ctx.getPendingByPosition(3)).toBeNull();
    expect(ctx.getPendingByPosition(0)).toBeNull();
    expect(ctx.pendingCount()).toBe(2);
  });

  it("hasPendingList toggles only after setPendingList", () => {
    const ctx = makeCtx();
    expect(ctx.hasPendingList()).toBe(false);
    ctx.setPendingList([]);
    expect(ctx.hasPendingList()).toBe(true);
  });

  it("replyBuffer accepts up to MAX_BUBBLES and rejects after", () => {
    const ctx = makeCtx();
    expect(ctx.hasReplyBubbles()).toBe(false);
    for (let i = 0; i < TurnContext.MAX_BUBBLES; i++) {
      const r = ctx.pushReply(`bubble ${i + 1}`);
      expect(r.ok).toBe(true);
    }
    const overflow = ctx.pushReply("one too many");
    expect(overflow.ok).toBe(false);
    expect(overflow.reason).toBe("bubble_limit_reached");
    expect(ctx.getReplyBubbles()).toHaveLength(TurnContext.MAX_BUBBLES);
  });
});
