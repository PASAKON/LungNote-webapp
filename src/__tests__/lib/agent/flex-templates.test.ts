import { describe, it, expect } from "vitest";
import { buildFlexMessage } from "@/lib/agent/flex/templates";
import type { FlexMessage } from "@/lib/line/client";

function asFlex(msg: ReturnType<typeof buildFlexMessage>): FlexMessage {
  if (msg.type !== "flex") throw new Error("expected flex");
  return msg;
}

const NO_LEFTOVER = /\{\{[\w[\].]+\}\}/;

describe("flex template builders (v2 schema)", () => {
  it("todo_saved fills placeholders + altText", () => {
    const m = asFlex(
      buildFlexMessage("todo_saved", {
        text: "ส่งการบ้าน",
        due_text: "พรุ่งนี้",
        folder_name: "ฟิสิกส์",
        open_url: "https://lungnote.com/dashboard/todo",
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(NO_LEFTOVER);
    expect(json).toContain("ส่งการบ้าน");
    expect(json).toContain("พรุ่งนี้");
    expect(json).toContain("ฟิสิกส์");
  });

  it("todo_saved defaults due_text + folder_name when omitted", () => {
    const m = asFlex(
      buildFlexMessage("todo_saved", {
        text: "x",
        open_url: "https://example.com",
      }),
    );
    expect(JSON.stringify(m)).not.toMatch(NO_LEFTOVER);
  });

  it("todo_deleted carries remaining_count + folder", () => {
    const m = asFlex(
      buildFlexMessage("todo_deleted", {
        text: "ทดสอบ",
        remaining_count: 4,
        folder_name: "Inbox",
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(NO_LEFTOVER);
    expect(json).toContain("ทดสอบ");
    expect(json).toContain("4 รายการ");
  });

  it("todo_updated shows change_summary + diff", () => {
    const m = asFlex(
      buildFlexMessage("todo_updated", {
        text: "ประชุม Exness",
        old_value: "พรุ่งนี้",
        new_value: "วันศุกร์ 09:00",
        change_summary: "เลื่อนเป็นวันศุกร์",
        open_url: "https://lungnote.com/dashboard/todo",
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(NO_LEFTOVER);
    expect(json).toContain("ประชุม Exness");
    expect(json).toContain("วันศุกร์ 09:00");
    expect(json).toContain("เลื่อนเป็นวันศุกร์");
  });

  it("todo_completed strikes through + counts remaining", () => {
    const m = asFlex(
      buildFlexMessage("todo_completed", {
        text: "ส่งงาน",
        pending_count_left: 3,
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(NO_LEFTOVER);
    expect(json).toContain("ส่งงาน");
    expect(json).toContain("3");
  });

  it("todo_list — full 4 items, no rows pruned", () => {
    const m = asFlex(
      buildFlexMessage("todo_list", {
        count: 4,
        date_thai: "10 พ.ค. 2026",
        items: [
          { idx: 1, text: "ส่งการบ้าน", due_short: "พรุ่งนี้", urgency_color: "#e8a946" },
          { idx: 2, text: "ซื้อนม", due_short: "", urgency_color: "#a08050" },
          { idx: 3, text: "โทรหาแม่", due_short: "เลย 1 วัน", urgency_color: "#c45a3a" },
          { idx: 4, text: "ทบทวน", due_short: "อีก 5 วัน", urgency_color: "#3a3020" },
        ],
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(NO_LEFTOVER);
    expect(json).toContain("ส่งการบ้าน");
    expect(json).toContain("ทบทวน");
    expect(json).toContain("4 รายการ");
  });

  it("todo_list — 2 items, 2 unused rows pruned", () => {
    const m = asFlex(
      buildFlexMessage("todo_list", {
        count: 2,
        date_thai: "10 พ.ค.",
        items: [
          { idx: 1, text: "งาน A", due_short: "พรุ่งนี้", urgency_color: "#e8a946" },
          { idx: 2, text: "งาน B", due_short: "", urgency_color: "#a08050" },
        ],
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(/\{\{item_\d+_\w+\}\}/);
    expect(json).toContain("งาน A");
    expect(json).toContain("งาน B");
  });

  it("todo_list — >4 items shown only first 4", () => {
    const items = Array.from({ length: 7 }, (_, i) => ({
      idx: i + 1,
      text: `Item ${i + 1}`,
      due_short: "",
      urgency_color: "#3a3020",
    }));
    const m = asFlex(
      buildFlexMessage("todo_list", {
        count: 7,
        date_thai: "10 พ.ค.",
        items,
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(NO_LEFTOVER);
    expect(json).toContain("Item 1");
    expect(json).toContain("Item 4");
    expect(json).not.toContain("Item 5");
    expect(json).toContain("7 รายการ");
  });

  it("todo_empty fills counts + streak", () => {
    const m = asFlex(
      buildFlexMessage("todo_empty", {
        completed_this_week: 5,
        streak_days: 3,
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(NO_LEFTOVER);
  });

  it("todo_empty defaults to 0/0 when omitted", () => {
    const m = asFlex(buildFlexMessage("todo_empty", {}));
    expect(JSON.stringify(m)).not.toMatch(NO_LEFTOVER);
  });

  it("error_inline picks variant + fills max_position", () => {
    const m = asFlex(
      buildFlexMessage("error_inline", {
        variant: "out_of_range",
        max_position: 4,
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(NO_LEFTOVER);
    expect(json).toContain("ตำแหน่ง");
    expect(json).toContain("4");
  });

  it("error_inline supports all 4 variants", () => {
    for (const variant of ["not_linked", "out_of_range", "ai_timeout", "generic"] as const) {
      const m = asFlex(buildFlexMessage("error_inline", { variant }));
      expect(JSON.stringify(m)).not.toMatch(NO_LEFTOVER);
    }
  });

  it("multi_save_summary — 2 items full", () => {
    const m = asFlex(
      buildFlexMessage("multi_save_summary", {
        count: 2,
        items: [
          { text: "ซื้อนม", date: "พรุ่งนี้", folder: "Inbox" },
          { text: "โทรหาแม่", date: "วันนี้", folder: "Inbox" },
        ],
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(NO_LEFTOVER);
    expect(json).toContain("ซื้อนม");
    expect(json).toContain("โทรหาแม่");
  });

  it("multi_save_summary — 1 item, 1 row pruned", () => {
    const m = asFlex(
      buildFlexMessage("multi_save_summary", {
        count: 1,
        items: [{ text: "เพียงอย่างเดียว", folder: "Inbox" }],
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(/\{\{item_\d+_\w+\}\}/);
    expect(json).toContain("เพียงอย่างเดียว");
  });

  it("custom altText overrides template default", () => {
    const m = asFlex(
      buildFlexMessage(
        "todo_saved",
        {
          text: "x",
          open_url: "https://example.com",
        },
        "สิ่งที่ฉันคุม",
      ),
    );
    expect(m.altText).toBe("สิ่งที่ฉันคุม");
  });

  it("liff_id auto-injected from env (no leftover marker)", () => {
    const m = asFlex(
      buildFlexMessage("todo_deleted", {
        text: "x",
        remaining_count: 0,
      }),
    );
    expect(JSON.stringify(m)).not.toMatch(/\{\{liff_id\}\}/);
  });

  it("never produces empty text nodes (LINE 400 guard)", () => {
    const m = buildFlexMessage("todo_saved", {
      text: "x",
      open_url: "https://example.com",
      due_text: "",
      folder_name: "",
    });
    expect(JSON.stringify(m)).not.toMatch(/"text":""/);
  });
});
