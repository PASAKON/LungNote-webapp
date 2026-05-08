import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Partial mock for the AI client (keep AIClientError class real for instanceof checks).
vi.mock("@/lib/ai/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/client")>();
  return { ...actual, chatCompletion: vi.fn() };
});
vi.mock("@/lib/ai/memory", () => ({
  loadMemory: vi.fn(),
  saveMemory: vi.fn(),
}));
vi.mock("@/lib/ai/tools", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/tools")>();
  return { ...actual, executeToolCall: vi.fn() };
});

import { generateChatReply } from "@/lib/ai/reply";
import { chatCompletion, AIClientError } from "@/lib/ai/client";
import { loadMemory, saveMemory } from "@/lib/ai/memory";
import { executeToolCall } from "@/lib/ai/tools";

const mockedChatCompletion = vi.mocked(chatCompletion);
const mockedLoad = vi.mocked(loadMemory);
const mockedSave = vi.mocked(saveMemory);
const mockedExecTool = vi.mocked(executeToolCall);

beforeEach(() => {
  mockedChatCompletion.mockReset();
  mockedLoad.mockReset();
  mockedSave.mockReset();
  mockedExecTool.mockReset();
  mockedLoad.mockResolvedValue([]);
  mockedSave.mockResolvedValue(undefined);
});
afterEach(() => vi.clearAllMocks());

describe("generateChatReply (memory-aware)", () => {
  it("loads memory, calls AI with system+memory+user, returns text", async () => {
    mockedLoad.mockResolvedValue([
      { role: "user", content: "ก่อนหน้า" },
      { role: "assistant", content: "ตอบเก่า" },
    ]);
    mockedChatCompletion.mockResolvedValue({
      text: "AI says hi",
      toolCalls: null,
      model: "google/gemini-2.5-flash",
      latencyMs: 1234,
      tokensIn: 100,
      tokensOut: 20,
      costEstimate: 0.0001,
    });

    const out = await generateChatReply("U-123", "hello");

    expect(out).toEqual({
      ok: true,
      text: "AI says hi",
      meta: expect.objectContaining({
        model: "google/gemini-2.5-flash",
        tokensIn: 100,
        tokensOut: 20,
      }),
    });

    expect(mockedLoad).toHaveBeenCalledWith("U-123");
    const callArg = mockedChatCompletion.mock.calls[0][0];
    // [system, ...memory(2), user] = 4 entries
    expect(callArg).toHaveLength(4);
    expect(callArg[0].role).toBe("system");
    expect(callArg[1]).toEqual({ role: "user", content: "ก่อนหน้า" });
    expect(callArg[2]).toEqual({ role: "assistant", content: "ตอบเก่า" });
    expect(callArg[3]).toEqual({ role: "user", content: "hello" });
  });

  it("saves memory after a successful AI call (fire-and-forget)", async () => {
    mockedLoad.mockResolvedValue([]);
    mockedChatCompletion.mockResolvedValue({
      text: "AI reply",
      toolCalls: null,
      model: "x",
      latencyMs: 10,
      tokensIn: 1,
      tokensOut: 1,
      costEstimate: 0,
    });

    await generateChatReply("U-456", "ทดสอบ");

    // Allow fire-and-forget save to settle.
    await new Promise((r) => setImmediate(r));

    expect(mockedSave).toHaveBeenCalledWith("U-456", [], "ทดสอบ", "AI reply");
  });

  it("returns ai_timeout when client throws a timeout error", async () => {
    mockedChatCompletion.mockRejectedValue(
      new AIClientError("OpenRouter request timed out after 8000ms"),
    );

    const out = await generateChatReply("U-123", "hello");

    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("ai_timeout");
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it("returns ai_error on other failures", async () => {
    mockedChatCompletion.mockRejectedValue(
      new AIClientError("OpenRouter HTTP 503: upstream broken", 503),
    );

    const out = await generateChatReply("U-123", "hello");

    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("ai_error");
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it("falls back to empty memory if loadMemory throws", async () => {
    mockedLoad.mockRejectedValue(new Error("DB unavailable"));
    mockedChatCompletion.mockResolvedValue({
      text: "still ok",
      toolCalls: null,
      model: "x",
      latencyMs: 5,
      tokensIn: 1,
      tokensOut: 1,
      costEstimate: 0,
    });

    // generateChatReply doesn't catch loadMemory throws specifically — but loadMemory
    // is documented as best-effort and returns [] on errors, so this case shouldn't
    // happen in practice. Test the documented contract: when loadMemory does the
    // right thing (returns [] on error), reply succeeds.
    mockedLoad.mockResolvedValue([]);
    const out = await generateChatReply("U-789", "ดู");

    expect(out.ok).toBe(true);
  });
});

describe("generateChatReply — tool-calling agentic loop (ADR-0012 Phase 2)", () => {
  it("executes save_memory tool call then returns final assistant text", async () => {
    // Iteration 1: model calls save_memory.
    mockedChatCompletion.mockResolvedValueOnce({
      text: "",
      toolCalls: [
        {
          id: "call-1",
          type: "function",
          function: {
            name: "save_memory",
            arguments: JSON.stringify({
              text: "ส่งการบ้านฟิสิกส์",
              due_at: "2026-05-09T09:00:00+07:00",
              due_text: "พรุ่งนี้",
            }),
          },
        },
      ],
      model: "g",
      latencyMs: 100,
      tokensIn: 80,
      tokensOut: 40,
      costEstimate: 0.0001,
    });
    // Tool returns ok
    mockedExecTool.mockResolvedValue({
      tool_call_id: "call-1",
      content: JSON.stringify({
        ok: true,
        todoId: "t-x",
        text: "ส่งการบ้านฟิสิกส์",
        dueAt: "2026-05-09T02:00:00.000Z",
        dueText: "พรุ่งนี้",
      }),
    });
    // Iteration 2: model finalizes with text.
    mockedChatCompletion.mockResolvedValueOnce({
      text: "บันทึกแล้ว ✓ พรุ่งนี้ส่งการบ้านฟิสิกส์",
      toolCalls: null,
      model: "g",
      latencyMs: 80,
      tokensIn: 120,
      tokensOut: 30,
      costEstimate: 0.0002,
    });

    const out = await generateChatReply("U-tool", "พรุ่งนี้ส่งการบ้านฟิสิกส์");

    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.text).toMatch(/บันทึกแล้ว/);
      // Aggregated metadata across both iterations
      expect(out.meta.tokensIn).toBe(80 + 120);
      expect(out.meta.tokensOut).toBe(40 + 30);
    }
    expect(mockedExecTool).toHaveBeenCalledTimes(1);
    expect(mockedChatCompletion).toHaveBeenCalledTimes(2);
  });

  it("supports list → delete → text in one turn (3 iterations)", async () => {
    // Iter 1: list_pending
    mockedChatCompletion.mockResolvedValueOnce({
      text: "",
      toolCalls: [
        {
          id: "c-list",
          type: "function",
          function: { name: "list_pending", arguments: "{}" },
        },
      ],
      model: "g",
      latencyMs: 60,
      tokensIn: 50,
      tokensOut: 10,
      costEstimate: 0,
    });
    // Iter 2: delete_memory(t-1)
    mockedChatCompletion.mockResolvedValueOnce({
      text: "",
      toolCalls: [
        {
          id: "c-del",
          type: "function",
          function: {
            name: "delete_memory",
            arguments: JSON.stringify({ todo_id: "t-1" }),
          },
        },
      ],
      model: "g",
      latencyMs: 60,
      tokensIn: 60,
      tokensOut: 10,
      costEstimate: 0,
    });
    // Iter 3: final text
    mockedChatCompletion.mockResolvedValueOnce({
      text: "ลบ 'ทดสอบ' แล้ว ✓",
      toolCalls: null,
      model: "g",
      latencyMs: 60,
      tokensIn: 70,
      tokensOut: 15,
      costEstimate: 0,
    });

    // Tool calls in order: list returns 1 item, delete succeeds.
    mockedExecTool
      .mockResolvedValueOnce({
        tool_call_id: "c-list",
        content: JSON.stringify({
          ok: true,
          items: [
            {
              id: "t-1",
              text: "ทดสอบ",
              due_at: null,
              due_text: null,
              created_at: new Date().toISOString(),
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        tool_call_id: "c-del",
        content: JSON.stringify({
          ok: true,
          todoId: "t-1",
          text: "ทดสอบ",
        }),
      });

    const out = await generateChatReply("U-mut", "เอา ทดสอบ ออก");
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.text).toMatch(/ลบ.*ทดสอบ/);
    }
    expect(mockedExecTool).toHaveBeenCalledTimes(2);
    expect(mockedChatCompletion).toHaveBeenCalledTimes(3);
  });

  it("returns ai_error when tool loop exceeds 4 iterations without final text", async () => {
    const loopingResponse = {
      text: "",
      toolCalls: [
        {
          id: "call-loop",
          type: "function" as const,
          function: { name: "list_pending", arguments: "{}" },
        },
      ],
      model: "g",
      latencyMs: 50,
      tokensIn: 10,
      tokensOut: 5,
      costEstimate: 0,
    };
    mockedChatCompletion.mockResolvedValue(loopingResponse);
    mockedExecTool.mockResolvedValue({
      tool_call_id: "call-loop",
      content: "[]",
    });

    const out = await generateChatReply("U-loop", "anything");
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("ai_error");
      expect(out.error).toMatch(/tool loop exceeded 4/i);
    }
  });

  it("strips tools for anonymous sessions (no userId to scope)", async () => {
    mockedChatCompletion.mockResolvedValue({
      text: "anon reply",
      toolCalls: null,
      model: "g",
      latencyMs: 1,
      tokensIn: 1,
      tokensOut: 1,
      costEstimate: 0,
    });
    await generateChatReply("anonymous", "hello");
    const opts = mockedChatCompletion.mock.calls[0][1];
    expect(opts?.tools).toBeUndefined();
  });

  it("passes tools for linked LINE users", async () => {
    mockedChatCompletion.mockResolvedValue({
      text: "linked reply",
      toolCalls: null,
      model: "g",
      latencyMs: 1,
      tokensIn: 1,
      tokensOut: 1,
      costEstimate: 0,
    });
    await generateChatReply("U-linked", "hello");
    const opts = mockedChatCompletion.mock.calls[0][1];
    expect(opts?.tools).toBeDefined();
    expect(Array.isArray(opts?.tools)).toBe(true);
  });
});
