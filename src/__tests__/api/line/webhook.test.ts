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
vi.mock("@/lib/memory/save", () => ({
  saveMemoryFromLine: vi.fn(),
}));
vi.mock("@/lib/memory/list", () => ({
  listPendingFromLine: vi.fn(),
}));
vi.mock("@/lib/auth/line-link", () => ({
  mintToken: vi.fn(),
}));
vi.mock("@/lib/ai/memory", () => ({
  loadMemory: vi.fn().mockResolvedValue([]),
  saveMemory: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/line/webhook/route";
import { replyMessage } from "@/lib/line/client";
import { generateChatReply } from "@/lib/ai/reply";
import { saveMemoryFromLine } from "@/lib/memory/save";
import { listPendingFromLine } from "@/lib/memory/list";
import { loadMemory, saveMemory } from "@/lib/ai/memory";

const mockedReply = vi.mocked(replyMessage);
const mockedAI = vi.mocked(generateChatReply);
const mockedSaveMemory = vi.mocked(saveMemoryFromLine);
const mockedListMemory = vi.mocked(listPendingFromLine);
const mockedLoadMemory = vi.mocked(loadMemory);
const mockedConvSaveMemory = vi.mocked(saveMemory);

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
  // Existing tests cover legacy regex routing (path_dashboard / path_list /
  // path_memory / path_regex). Agent mode (default true in prod) routes
  // everything through the AI fallback and is exercised by reply.test.ts.
  process.env.AI_AGENT_MODE = "false";
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/line/webhook — text events", () => {
  it("replies with regex menu for 'สวัสดี' (no AI call, no memory save)", async () => {
    const body = {
      destination: "U_dest",
      events: [textEvent("RT-1", "สวัสดี")],
    };
    const res = await POST(makeRequest(body) as never);
    expect(res.status).toBe(200);
    expect(mockedAI).not.toHaveBeenCalled();
    expect(mockedSaveMemory).not.toHaveBeenCalled();
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
    expect(mockedAI).toHaveBeenCalledWith("U-abc", "อธิบาย Pythagorean", expect.anything());
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
    // welcomeMessage() returns a flex bubble; altText carries the visible welcome string.
    expect(mockedReply).toHaveBeenCalledWith(
      "RT-5",
      expect.arrayContaining([
        expect.objectContaining({
          type: "flex",
          altText: expect.stringContaining("ยินดีต้อนรับ"),
        }),
      ]),
    );
  });
});

describe("POST /api/line/webhook — memory prefix (ADR-0012)", () => {
  it("saves memory when prefix matches and profile is linked", async () => {
    mockedSaveMemory.mockResolvedValue({
      ok: true,
      todoId: "todo-123",
      text: "ซื้อนม\nนม 1 ลิตร",
      dueAt: null,
      dueText: null,
    });
    const body = {
      destination: "U_dest",
      events: [textEvent("RT-N1", "จด ซื้อนม\nนม 1 ลิตร")],
    };
    await POST(makeRequest(body) as never);

    expect(mockedAI).not.toHaveBeenCalled();
    expect(mockedSaveMemory).toHaveBeenCalledWith("U-abc", "ซื้อนม\nนม 1 ลิตร");
    expect(mockedReply).toHaveBeenCalledWith(
      "RT-N1",
      expect.arrayContaining([
        expect.objectContaining({ text: expect.stringContaining("บันทึกแล้ว") }),
      ]),
    );
  });

  it("triggers on 'todo' / 'ทำ' / 'เตือน' prefixes (unified handler)", async () => {
    mockedSaveMemory.mockResolvedValue({
      ok: true,
      todoId: "todo-x",
      text: "อ่านบทที่ 3",
      dueAt: null,
      dueText: null,
    });
    for (const text of ["todo อ่านบทที่ 3", "ทำ อ่านบทที่ 3", "เตือน อ่านบทที่ 3"]) {
      mockedSaveMemory.mockClear();
      const body = {
        destination: "U_dest",
        events: [textEvent("RT-T", text)],
      };
      await POST(makeRequest(body) as never);
      expect(mockedSaveMemory).toHaveBeenCalledWith("U-abc", "อ่านบทที่ 3");
    }
  });

  it("includes due-date line in reply when extractor returns due_at", async () => {
    mockedSaveMemory.mockResolvedValue({
      ok: true,
      todoId: "todo-due",
      text: "ส่งการบ้านฟิสิกส์",
      dueAt: "2026-05-09T02:00:00.000Z", // 09:00 BKK
      dueText: "พรุ่งนี้",
    });
    const body = {
      destination: "U_dest",
      events: [textEvent("RT-DUE", "เตือน พรุ่งนี้ส่งการบ้านฟิสิกส์")],
    };
    await POST(makeRequest(body) as never);

    expect(mockedReply).toHaveBeenCalledWith(
      "RT-DUE",
      expect.arrayContaining([
        expect.objectContaining({ text: expect.stringContaining("พรุ่งนี้") }),
      ]),
    );
  });

  it("saves memory-creation turn to conversation memory", async () => {
    mockedSaveMemory.mockResolvedValue({
      ok: true,
      todoId: "todo-456",
      text: "ซื้อนม",
      dueAt: null,
      dueText: null,
    });
    mockedLoadMemory.mockResolvedValue([]);
    const body = {
      destination: "U_dest",
      events: [textEvent("RT-N5", "จด ซื้อนม")],
    };
    await POST(makeRequest(body) as never);

    await new Promise((r) => setImmediate(r));

    expect(mockedLoadMemory).toHaveBeenCalledWith("U-abc");
    expect(mockedConvSaveMemory).toHaveBeenCalledWith(
      "U-abc",
      [],
      "จด ซื้อนม",
      expect.stringContaining("บันทึกแล้ว"),
    );
  });

  it("rejects with dashboard redirect when user is not linked", async () => {
    mockedSaveMemory.mockResolvedValue({ ok: false, reason: "not_linked" });
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

  it("apologizes when memory save has a db error", async () => {
    mockedSaveMemory.mockResolvedValue({
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

  it("triggers on compound 'เพิ่มสิ่งที่ต้องทำ <text>'", async () => {
    mockedSaveMemory.mockResolvedValue({
      ok: true,
      todoId: "todo-c",
      text: "กินข้าวเช้า",
      dueAt: null,
      dueText: null,
    });
    const body = {
      destination: "U_dest",
      events: [textEvent("RT-CMP", "เพิ่มสิ่งที่ต้องทำ กินข้าวเช้า")],
    };
    await POST(makeRequest(body) as never);
    expect(mockedSaveMemory).toHaveBeenCalledWith("U-abc", "กินข้าวเช้า");
  });

  it("triggers on 'อย่าลืม <text>' single prefix", async () => {
    mockedSaveMemory.mockResolvedValue({
      ok: true,
      todoId: "todo-y",
      text: "ส่งงาน",
      dueAt: null,
      dueText: null,
    });
    const body = {
      destination: "U_dest",
      events: [textEvent("RT-Y", "อย่าลืม ส่งงาน")],
    };
    await POST(makeRequest(body) as never);
    expect(mockedSaveMemory).toHaveBeenCalledWith("U-abc", "ส่งงาน");
  });

  it("does NOT trigger memory path when prefix has no content", async () => {
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

    expect(mockedSaveMemory).not.toHaveBeenCalled();
    expect(mockedAI).toHaveBeenCalledWith("U-abc", "จด", expect.anything());
  });
});

describe("POST /api/line/webhook — list-pending intent", () => {
  it("replies with formatted pending list for 'งานค้าง'", async () => {
    mockedListMemory.mockResolvedValue({
      ok: true,
      items: [
        {
          id: "t1",
          text: "ส่งการบ้านฟิสิกส์",
          due_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          due_text: "พรุ่งนี้",
          created_at: new Date().toISOString(),
        },
        {
          id: "t2",
          text: "ซื้อนม",
          due_at: null,
          due_text: null,
          created_at: new Date().toISOString(),
        },
      ],
    });
    const body = {
      destination: "U_dest",
      events: [textEvent("RT-L1", "งานค้าง")],
    };
    await POST(makeRequest(body) as never);

    expect(mockedListMemory).toHaveBeenCalledWith("U-abc");
    expect(mockedSaveMemory).not.toHaveBeenCalled();
    expect(mockedAI).not.toHaveBeenCalled();
    expect(mockedReply).toHaveBeenCalledWith(
      "RT-L1",
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringContaining("งานค้าง 2 รายการ"),
        }),
      ]),
    );
  });

  it("replies cheerful empty state when no pending items", async () => {
    mockedListMemory.mockResolvedValue({ ok: true, items: [] });
    const body = {
      destination: "U_dest",
      events: [textEvent("RT-L2", "ดูโน๊ตหน่อย")],
    };
    await POST(makeRequest(body) as never);

    expect(mockedReply).toHaveBeenCalledWith(
      "RT-L2",
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringContaining("ไม่มีงานค้าง"),
        }),
      ]),
    );
  });

  it("triggers on 'ตอนนี้มีงานอะไรบ้างที่ค้าง' natural phrasing", async () => {
    mockedListMemory.mockResolvedValue({ ok: true, items: [] });
    const body = {
      destination: "U_dest",
      events: [textEvent("RT-L3", "ตอนนี้มีงานอะไรบ้างที่ค้าง")],
    };
    await POST(makeRequest(body) as never);
    expect(mockedListMemory).toHaveBeenCalled();
  });

  it("redirects to dashboard when not linked", async () => {
    mockedListMemory.mockResolvedValue({ ok: false, reason: "not_linked" });
    const body = {
      destination: "U_dest",
      events: [textEvent("RT-L4", "งานค้าง")],
    };
    await POST(makeRequest(body) as never);
    expect(mockedReply).toHaveBeenCalledWith(
      "RT-L4",
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringContaining("dashboard"),
        }),
      ]),
    );
  });
});
