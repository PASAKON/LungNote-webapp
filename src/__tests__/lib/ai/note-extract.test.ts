import { describe, it, expect } from "vitest";
import { fallbackSplit } from "@/lib/ai/note-extract";

describe("fallbackSplit", () => {
  it("single line: whole text becomes title, body empty", () => {
    expect(fallbackSplit("ซื้อนม")).toEqual({
      title: "ซื้อนม",
      body: "",
    });
  });

  it("multi-line: first line is title, rest is body", () => {
    expect(fallbackSplit("ซื้อของ\nนม 1 ลิตร\nไข่ไก่ 12 ฟอง")).toEqual({
      title: "ซื้อของ",
      body: "นม 1 ลิตร\nไข่ไก่ 12 ฟอง",
    });
  });

  it("trims surrounding whitespace from title and body", () => {
    expect(fallbackSplit("  hello  \n\n  body content  ")).toEqual({
      title: "hello",
      body: "body content",
    });
  });

  it("title is capped at 200 chars", () => {
    const long = "a".repeat(300);
    const out = fallbackSplit(long);
    expect(out.title).toHaveLength(200);
    expect(out.body).toBe("");
  });

  it("empty input returns empty title and body", () => {
    expect(fallbackSplit("")).toEqual({ title: "", body: "" });
  });
});
