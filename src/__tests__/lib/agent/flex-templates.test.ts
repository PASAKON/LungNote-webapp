import { describe, it, expect } from "vitest";
import { buildFlexMessage } from "@/lib/agent/flex/templates";
import type { FlexMessage } from "@/lib/line/client";

function asFlex(msg: ReturnType<typeof buildFlexMessage>): FlexMessage {
  if (msg.type !== "flex") throw new Error("expected flex");
  return msg;
}

describe("flex template builders", () => {
  it("todo_saved fills placeholders + altText", () => {
    const m = asFlex(
      buildFlexMessage("todo_saved", {
        text: "ส่งการบ้าน",
        due_at_pretty: "พรุ่งนี้ 09:00",
        folder_name: "ฟิสิกส์",
        open_url: "https://lungnote.com/dashboard/todo",
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(/\{\{\w+\}\}/);
    expect(json).toContain("ส่งการบ้าน");
    expect(json).toContain("พรุ่งนี้ 09:00");
    expect(json).toContain("ฟิสิกส์");
    expect(m.altText).toContain("ส่งการบ้าน");
  });

  it("todo_deleted carries remaining_count", () => {
    const m = asFlex(
      buildFlexMessage("todo_deleted", {
        text: "ทดสอบ",
        remaining_count: 4,
        open_url: "https://lungnote.com/dashboard/todo",
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(/\{\{\w+\}\}/);
    expect(json).toContain("ทดสอบ");
    expect(json).toContain("4 รายการ");
  });

  it("todo_updated shows change_summary", () => {
    const m = asFlex(
      buildFlexMessage("todo_updated", {
        text: "ประชุม Exness",
        change_summary: "เลื่อนเป็นวันศุกร์",
        open_url: "https://lungnote.com/dashboard/todo",
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(/\{\{\w+\}\}/);
    expect(json).toContain("ประชุม Exness");
    expect(json).toContain("เลื่อนเป็นวันศุกร์");
  });

  it("todo_completed strikes through + counts remaining", () => {
    const m = asFlex(
      buildFlexMessage("todo_completed", {
        text: "ส่งงาน",
        pending_count_left: 3,
        open_url: "https://lungnote.com/dashboard/todo",
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(/\{\{\w+\}\}/);
    expect(json).toContain("ส่งงาน");
    expect(json).toContain("line-through");
    expect(json).toContain("3 งาน");
  });

  it("todo_list builds items rows + interleaves separators", () => {
    const m = asFlex(
      buildFlexMessage("todo_list", {
        count: 3,
        date_pretty: "10 พ.ค.",
        items: [
          {
            idx: 1,
            text: "ส่งการบ้าน",
            due_short: "พรุ่งนี้",
            urgency_color: "#e8a946",
          },
          {
            idx: 2,
            text: "ซื้อนม",
            due_short: "",
            urgency_color: "#a08050",
          },
          {
            idx: 3,
            text: "โทรหาแม่",
            due_short: "เลย 1 วัน",
            urgency_color: "#c45a3a",
          },
        ],
        open_url: "https://lungnote.com/dashboard/todo",
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(/\{\{\w+\}\}/);
    expect(json).toContain("ส่งการบ้าน");
    expect(json).toContain("ซื้อนม");
    expect(json).toContain("โทรหาแม่");
    expect(json).toContain("3 รายการ");
    // 3 items → 2 separators between rows.
    const sepMatches = json.match(/"type":"separator"/g) ?? [];
    expect(sepMatches.length).toBeGreaterThanOrEqual(3); // 1 top + 2 between
  });

  it("todo_list with empty items still builds (zero rows)", () => {
    const m = asFlex(
      buildFlexMessage("todo_list", {
        count: 0,
        date_pretty: "10 พ.ค.",
        items: [],
        open_url: "https://lungnote.com/dashboard/todo",
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(/\{\{ROWS\}\}/);
    expect(json).toContain("0 รายการ");
  });

  it("custom altText overrides template default", () => {
    const m = asFlex(
      buildFlexMessage(
        "todo_saved",
        {
          text: "x",
          open_url: "https://example.com",
          due_at_pretty: "—",
          folder_name: "Inbox",
        },
        "สิ่งที่ฉันคุม",
      ),
    );
    expect(m.altText).toBe("สิ่งที่ฉันคุม");
  });

  it("throws on missing required var (defensive)", () => {
    expect(() =>
      buildFlexMessage("todo_saved", {
        text: "x",
        open_url: "https://example.com",
        // missing due_at_pretty + folder_name
      } as never),
    ).toThrow(/unsubstituted markers/);
  });
});
