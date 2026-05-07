import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/line/verify", () => ({
  verifySignature: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/line/client", () => ({
  replyMessage: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
}));
vi.mock("@/lib/ai/reply", () => ({
  generateChatReply: vi.fn(),
}));

import { POST } from "@/app/api/line/webhook/route";
import { replyMessage } from "@/lib/line/client";
import { generateChatReply } from "@/lib/ai/reply";

const mockedReply = vi.mocked(replyMessage);
const mockedAI = vi.mocked(generateChatReply);

function makeRequest(body: unknown) {
  return new Request("https://lungnote.com/api/line/webhook", {
    method: "POST",
    headers: {
      "x-line-signature": "fake-sig",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.LINE_CHANNEL_SECRET = "secret";
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/line/webhook — text events", () => {
  it("replies with regex menu for 'สวัสดี' (no AI call)", async () => {
    const body = {
      destination: "U_dest",
      events: [{
        type: "message",
        replyToken: "RT-1",
        source: { type: "user", userId: "U-abc" },
        timestamp: Date.now(),
        message: { id: "m1", type: "text", text: "สวัสดี" },
      }],
    };
    const res = await POST(makeRequest(body) as never);
    expect(res.status).toBe(200);
    expect(mockedAI).not.toHaveBeenCalled();
    expect(mockedReply).toHaveBeenCalledWith("RT-1", [
      expect.objectContaining({ type: "text", text: expect.stringContaining("LungNote bot") }),
    ]);
  });

  it("calls AI for off-script messages and replies with AI text", async () => {
    mockedAI.mockResolvedValue({
      ok: true,
      text: "AI Thai reply",
      meta: { model: "x", latencyMs: 100, tokensIn: 50, tokensOut: 20, costEstimate: 0.0001 },
    });
    const body = {
      destination: "U_dest",
      events: [{
        type: "message",
        replyToken: "RT-2",
        source: { type: "user", userId: "U-abc" },
        timestamp: Date.now(),
        message: { id: "m2", type: "text", text: "อธิบาย Pythagorean" },
      }],
    };
    const res = await POST(makeRequest(body) as never);
    expect(res.status).toBe(200);
    expect(mockedAI).toHaveBeenCalledWith("U-abc", "อธิบาย Pythagorean");
    expect(mockedReply).toHaveBeenCalledWith("RT-2", [{ type: "text", text: "AI Thai reply" }]);
  });

  it("falls back to echo when AI errors", async () => {
    mockedAI.mockResolvedValue({ ok: false, reason: "ai_error", error: "HTTP 503" });
    const body = {
      destination: "U_dest",
      events: [{
        type: "message", replyToken: "RT-3",
        source: { type: "user", userId: "U-abc" }, timestamp: Date.now(),
        message: { id: "m3", type: "text", text: "weird question" },
      }],
    };
    await POST(makeRequest(body) as never);
    expect(mockedReply).toHaveBeenCalledWith("RT-3", [
      expect.objectContaining({ text: expect.stringContaining("รับข้อความแล้ว") }),
    ]);
  });

  it("falls back to echo on AI timeout", async () => {
    mockedAI.mockResolvedValue({ ok: false, reason: "ai_timeout" });
    const body = {
      destination: "U_dest",
      events: [{
        type: "message", replyToken: "RT-4",
        source: { type: "user", userId: "U-abc" }, timestamp: Date.now(),
        message: { id: "m4", type: "text", text: "another off-script" },
      }],
    };
    await POST(makeRequest(body) as never);
    expect(mockedReply).toHaveBeenCalledWith("RT-4", [
      expect.objectContaining({ text: expect.stringContaining("รับข้อความแล้ว") }),
    ]);
  });

  it("follow event sends welcome with AI disclosure", async () => {
    const body = {
      destination: "U_dest",
      events: [{
        type: "follow",
        replyToken: "RT-5",
        source: { type: "user", userId: "U-new" },
        timestamp: Date.now(),
      }],
    };
    await POST(makeRequest(body) as never);
    expect(mockedReply).toHaveBeenCalledWith("RT-5", [
      expect.objectContaining({ text: expect.stringContaining("AI") }),
    ]);
  });
});
