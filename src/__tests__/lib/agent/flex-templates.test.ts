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
        due_text: "พรุ่งนี้",
        folder_name: "ฟิสิกส์",
        open_url: "https://lungnote.com/dashboard/todo",
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(/\{\{[\w[\].]+\}\}/);
    expect(json).toContain("ส่งการบ้าน");
    expect(json).toContain("พรุ่งนี้");
    expect(json).toContain("ฟิสิกส์");
    expect(m.altText).toContain("ส่งการบ้าน");
  });

  it("todo_saved defaults due_text + folder_name when omitted", () => {
    const m = asFlex(
      buildFlexMessage("todo_saved", {
        text: "x",
        open_url: "https://example.com",
      }),
    );
    expect(JSON.stringify(m)).not.toMatch(/\{\{[\w[\].]+\}\}/);
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
    expect(json).not.toMatch(/\{\{[\w[\].]+\}\}/);
    expect(json).toContain("ทดสอบ");
    expect(json).toContain("4 รายการ");
  });

  it("todo_updated shows change_summary + old/new diff", () => {
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
    expect(json).not.toMatch(/\{\{[\w[\].]+\}\}/);
    expect(json).toContain("ประชุม Exness");
    expect(json).toContain("พรุ่งนี้");
    expect(json).toContain("วันศุกร์ 09:00");
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
    expect(json).not.toMatch(/\{\{[\w[\].]+\}\}/);
    expect(json).toContain("ส่งงาน");
    expect(json).toContain("line-through");
    expect(json).toContain("3 งาน");
  });

  it("todo_list — full 4 items, no rows pruned", () => {
    const m = asFlex(
      buildFlexMessage("todo_list", {
        count: 4,
        date_display: "10 พ.ค. 2026",
        items: [
          { idx: 1, text: "ส่งการบ้าน", due_short: "พรุ่งนี้", urgency_color: "#e8a946" },
          { idx: 2, text: "ซื้อนม", due_short: "", urgency_color: "#a08050" },
          { idx: 3, text: "โทรหาแม่", due_short: "เลย 1 วัน", urgency_color: "#c45a3a" },
          { idx: 4, text: "ทบทวน", due_short: "อีก 5 วัน", urgency_color: "#3a3020" },
        ],
        open_url: "https://lungnote.com/dashboard/todo",
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(/\{\{[\w[\].]+\}\}/);
    expect(json).toContain("ส่งการบ้าน");
    expect(json).toContain("ทบทวน");
    expect(json).toContain("4 รายการ");
  });

  it("todo_list — 2 items, 2 unused rows pruned (no leftover items[N])", () => {
    const m = asFlex(
      buildFlexMessage("todo_list", {
        count: 2,
        date_display: "10 พ.ค.",
        items: [
          { idx: 1, text: "งาน A", due_short: "พรุ่งนี้", urgency_color: "#e8a946" },
          { idx: 2, text: "งาน B", due_short: "", urgency_color: "#a08050" },
        ],
        open_url: "https://lungnote.com/dashboard/todo",
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(/\{\{items\[\d+\]/);
    expect(json).toContain("งาน A");
    expect(json).toContain("งาน B");
  });

  it("todo_list — >4 items, only first 4 shown (Phase 1 cap)", () => {
    const items = Array.from({ length: 7 }, (_, i) => ({
      idx: i + 1,
      text: `Item ${i + 1}`,
      due_short: "",
      urgency_color: "#3a3020",
    }));
    const m = asFlex(
      buildFlexMessage("todo_list", {
        count: 7,
        date_display: "10 พ.ค.",
        items,
        open_url: "https://lungnote.com/dashboard/todo",
      }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toMatch(/\{\{[\w[\].]+\}\}/);
    expect(json).toContain("Item 1");
    expect(json).toContain("Item 4");
    // Items 5-7 not in the bubble (they live in Dashboard).
    expect(json).not.toContain("Item 5");
    // Header still shows true total count.
    expect(json).toContain("7 รายการ");
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

  it("throws on missing required var (defensive)", () => {
    expect(() =>
      buildFlexMessage("todo_deleted", {
        text: "x",
        // missing remaining_count + open_url
      } as never),
    ).toThrow(/unsubstituted markers/);
  });

  it("never produces empty text nodes (LINE 400 guard)", () => {
    // todo_saved with empty due_text → withDefaults swaps in fallback.
    const m = buildFlexMessage("todo_saved", {
      text: "x",
      open_url: "https://example.com",
      due_text: "",
      folder_name: "",
    });
    const json = JSON.stringify(m);
    expect(json).not.toMatch(/"text":""/);
  });

  it("todo_list with empty due_short uses em-dash, no empty text node", () => {
    const m = buildFlexMessage("todo_list", {
      count: 1,
      date_display: "10 พ.ค.",
      items: [{ idx: 1, text: "x", due_short: "", urgency_color: "#a08050" }],
      open_url: "https://example.com",
    });
    const json = JSON.stringify(m);
    expect(json).not.toMatch(/"text":""/);
  });

  it("todo_completed with empty streak_msg fills with em-dash", () => {
    const m = buildFlexMessage("todo_completed", {
      text: "x",
      pending_count_left: 0,
      streak_msg: "",
      open_url: "https://example.com",
    });
    const json = JSON.stringify(m);
    expect(json).not.toMatch(/"text":""/);
  });
});
