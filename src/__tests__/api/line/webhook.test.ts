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
vi.mock("@/lib/notes/create", () => ({
  createNoteFromLine: vi.fn(),
}));
vi.mock("@/lib/auth/line-link", () => ({
  mintToken: vi.fn(),
}));

import { POST } from "@/app/api/line/webhook/route";
import { replyMessage } from "@/lib/line/client";
import { generateChatReply } from "@/lib/ai/reply";
import { createNoteFromLine } from "@/lib/notes/create";

const mockedReply = vi.mocked(replyMessage);
const mockedAI = vi.mocked(generateChatReply);
const mockedCreateNote = vi.mocked(createNoteFromLine);

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

function textEvent(replyToken: string, text: string, userId = "U-abc") {
  return {
    type: "message",
    replyToken,
    source: { type: "user", userId },
    timestamp: Date.now(),
    message: { id: "m" + replyToken, type: "text", text },
  };
}

beforeEach(() => {
  process.env.LINE_CHANNEL_SECRET = "secret";
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/line/webhook — text events", () => {
  it("replies with regex menu for 'สวัสดี' (no AI call, no note creation)", async () => {
    const body = {
      destination: "U_dest",
      events: [textEvent("RT-1", "สวัสดี")],
    };
    const res = await POST(makeRequest(body) as never);
    expect(res.status).toBe(200);
    expect(mockedAI).not.toHaveBeenCalled();
    expect(mockedCreateNote).not.toHaveBeenCalled();
    expect(mockedReply).toHaveBeenCalledWith("RT-1", [
      expect.objectContaining({
        type: "text",
        text: expect.stringContaining("LungNote bot"),
      }),
    ]);
  });

  it("calls AI for off-script messages and replies with AI text", async () => {
    mockedAI.mockResolvedValue({
      ok: true,
      text: "AI Thai reply",
      meta: {
        model: "x",
        latencyMs: 100,
        tokensIn: 50,
        tokensOut: 20,
        costEstimate: 0.0001,
      },
    });
    const body = {
      destination: "U_dest",
      events: [textEvent("RT-2", "อธิบาย Pythagorean")],
    };
    const res = await POST(makeRequest(body) as never);
    expect(res.status).toBe(200);
    expect(mockedAI).toHaveBeenCalledWith("U-abc", "อธิบาย Pythagorean");
    expect(mockedReply).toHaveBeenCalledWith("RT-2", [
      { type: "text", text: "AI Thai reply" },
    ]);
  });

  it("falls back to echo when AI errors", async () => {
    mockedAI.mockResolvedValue({ ok: false, reason: "ai_error", error: "HTTP 503" });
    const body = {
      destination: "U_dest",
      events: [textEvent("RT-3", "weird question")],
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
      events: [textEvent("RT-4", "another off-script")],
    };
    await POST(makeRequest(body) as never);
    expect(mockedReply).toHaveBeenCalledWith("RT-4", [
      expect.objectContaining({ text: expect.stringContaining("รับข้อความแล้ว") }),
    ]);
  });

  it("follow event sends a welcome reply", async () => {
    const body = {
      destination: "U_dest",
      events: [
        {
          type: "follow",
          replyToken: "RT-5",
          source: { type: "user", userId: "U-new" },
          timestamp: Date.now(),
        },
      ],
    };
    await POST(makeRequest(body) as never);
    // Loose check: a welcome message was sent. Disclosure copy lives in flex.ts
    // and is verified by its own test (when wired up).
    expect(mockedReply).toHaveBeenCalledWith(
      "RT-5",
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("ยินดีต้อนรับ"),
        }),
      ]),
    );
  });
});

describe("POST /api/line/webhook — note prefix", () => {
  it("creates a note when prefix matches and profile is linked", async () => {
    mockedCreateNote.mockResolvedValue({
      ok: true,
      noteId: "note-123",
      title: "ซื้อนม",
    });
    const body = {
      destination: "U_dest",
      events: [textEvent("RT-N1", "จด ซื้อนม\nนม 1 ลิตร")],
    };
    await POST(makeRequest(body) as never);

    expect(mockedAI).not.toHaveBeenCalled();
    expect(mockedCreateNote).toHaveBeenCalledWith("U-abc", "ซื้อนม\nนม 1 ลิตร");
    expect(mockedReply).toHaveBeenCalledWith(
      "RT-N1",
      expect.arrayContaining([
        expect.objectContaining({ text: expect.stringContaining("บันทึกแล้ว") }),
      ]),
    );
  });

  it("rejects with dashboard redirect when user is not linked", async () => {
    mockedCreateNote.mockResolvedValue({ ok: false, reason: "not_linked" });
    const body = {
      destination: "U_dest",
      events: [textEvent("RT-N2", "บันทึก ทดสอบ")],
    };
    await POST(makeRequest(body) as never);

    expect(mockedReply).toHaveBeenCalledWith(
      "RT-N2",
      expect.arrayContaining([
        expect.objectContaining({ text: expect.stringContaining("dashboard") }),
      ]),
    );
  });

  it("apologizes and falls back when note creation has a db error", async () => {
    mockedCreateNote.mockResolvedValue({
      ok: false,
      reason: "db_error",
      error: "constraint",
    });
    const body = {
      destination: "U_dest",
      events: [textEvent("RT-N3", "note something")],
    };
    await POST(makeRequest(body) as never);

    expect(mockedReply).toHaveBeenCalledWith(
      "RT-N3",
      expect.arrayContaining([
        expect.objectContaining({ text: expect.stringContaining("ลองอีกครั้ง") }),
      ]),
    );
  });

  it("does NOT trigger note path when prefix has no content", async () => {
    // Just "จด" with nothing after → fall through to AI fallback.
    mockedAI.mockResolvedValue({
      ok: true,
      text: "AI explanation of 'จด'",
      meta: {
        model: "x",
        latencyMs: 1,
        tokensIn: 1,
        tokensOut: 1,
        costEstimate: 0,
      },
    });
    const body = {
      destination: "U_dest",
      events: [textEvent("RT-N4", "จด")],
    };
    await POST(makeRequest(body) as never);

    expect(mockedCreateNote).not.toHaveBeenCalled();
    expect(mockedAI).toHaveBeenCalledWith("U-abc", "จด");
  });
});
