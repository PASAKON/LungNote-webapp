import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Partial mock: keep the real AIClientError class so instanceof checks work
// in the orchestrator, but replace chatCompletion with a controllable stub.
vi.mock("@/lib/ai/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/client")>();
  return { ...actual, chatCompletion: vi.fn() };
});

import { generateChatReply } from "@/lib/ai/reply";
import { chatCompletion, AIClientError } from "@/lib/ai/client";

const mockedChatCompletion = vi.mocked(chatCompletion);

beforeEach(() => {
  mockedChatCompletion.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe("generateChatReply (v0 stateless)", () => {
  it("returns AI text and meta on success", async () => {
    mockedChatCompletion.mockResolvedValue({
      text: "AI says hi",
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
    expect(mockedChatCompletion).toHaveBeenCalledOnce();
    const callArg = mockedChatCompletion.mock.calls[0][0];
    expect(Array.isArray(callArg)).toBe(true);
    // first message is system prompt, last is user message
    expect(callArg[0].role).toBe("system");
    expect(callArg[callArg.length - 1]).toEqual({ role: "user", content: "hello" });
  });

  it("returns ai_timeout when client throws a timeout error", async () => {
    mockedChatCompletion.mockRejectedValue(
      new AIClientError("OpenRouter request timed out after 8000ms"),
    );

    const out = await generateChatReply("U-123", "hello");

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("ai_timeout");
    }
  });

  it("returns ai_error on other AIClientErrors", async () => {
    mockedChatCompletion.mockRejectedValue(
      new AIClientError("OpenRouter HTTP 503: upstream broken", 503),
    );

    const out = await generateChatReply("U-123", "hello");

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("ai_error");
    }
  });

  it("returns ai_error on non-AIClientError throws too", async () => {
    mockedChatCompletion.mockRejectedValue(new Error("network unreachable"));

    const out = await generateChatReply("U-123", "hello");

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("ai_error");
    }
  });
});
