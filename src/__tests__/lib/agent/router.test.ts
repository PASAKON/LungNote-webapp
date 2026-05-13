import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { routeModel } from "@/lib/agent/router";

const FAST = "google/gemini-2.5-flash";
const COMPLEX = "google/gemini-2.5-pro";

describe("agent router", () => {
  beforeEach(() => {
    process.env.LLM_ROUTER_ENABLED = "true";
    process.env.ROUTER_FAST_MODEL = FAST;
    process.env.ROUTER_COMPLEX_MODEL = COMPLEX;
  });
  afterEach(() => {
    delete process.env.LLM_ROUTER_ENABLED;
    delete process.env.ROUTER_FAST_MODEL;
    delete process.env.ROUTER_COMPLEX_MODEL;
    delete process.env.LLM_MODEL;
  });

  it("returns fast model for simple save", () => {
    const r = routeModel("ซื้อนม");
    expect(r.modelId).toBe(FAST);
    expect(r.reason).toBe("default");
  });

  it("returns fast model for simple list", () => {
    const r = routeModel("ดู todo");
    expect(r.modelId).toBe(FAST);
  });

  it("escalates on update verb 'เลื่อน'", () => {
    const r = routeModel("เลื่อนข้อ 2 เป็นพฤหัส");
    expect(r.modelId).toBe(COMPLEX);
    expect(r.reason).toBe("update_verb");
  });

  it("escalates on update verb 'แก้'", () => {
    const r = routeModel("แก้ข้อ 3 เป็น 'ซื้อขนมปัง'");
    expect(r.modelId).toBe(COMPLEX);
    expect(r.reason).toBe("update_verb");
  });

  it("escalates on profile fact 'ฉันชื่อ'", () => {
    const r = routeModel("ฉันชื่อมิว");
    expect(r.modelId).toBe(COMPLEX);
    expect(r.reason).toBe("profile_fact");
  });

  it("escalates on profile fact 'ฉันอยู่กรุงเทพ'", () => {
    const r = routeModel("ฉันอยู่กรุงเทพ");
    expect(r.modelId).toBe(COMPLEX);
    expect(r.reason).toBe("profile_fact");
  });

  it("escalates on multi-position with connector", () => {
    const r = routeModel("ลบ 1 และ 3");
    expect(r.modelId).toBe(COMPLEX);
    expect(r.reason).toBe("multi_position");
  });

  it("stays fast for single position", () => {
    const r = routeModel("ลบข้อ 2");
    expect(r.modelId).toBe(FAST);
  });

  it("escalates on multi-clause turn (list then mutate)", () => {
    const r = routeModel("ดูลิสต์หน่อย แล้วติ๊กข้อ 4 ให้ที");
    expect(r.modelId).toBe(COMPLEX);
    expect(r.reason).toBe("complex_clause");
  });

  it("does NOT escalate on completed-phrase 'เสร็จแล้ว'", () => {
    // Common pattern after the AI has shown a list — user marks one done.
    // Flash handles this fine; escalating here would waste Pro budget.
    const r = routeModel("อันที่ 3 เสร็จแล้ว");
    expect(r.modelId).toBe(FAST);
  });

  it("escalates on long messages", () => {
    const long = "ก".repeat(200);
    const r = routeModel(long);
    expect(r.modelId).toBe(COMPLEX);
    expect(r.reason).toBe("long_message");
  });

  it("falls back to LLM_MODEL when router disabled", () => {
    delete process.env.LLM_ROUTER_ENABLED;
    process.env.LLM_MODEL = "anthropic/claude-haiku-4-5";
    const r = routeModel("ซื้อนม");
    expect(r.modelId).toBe("anthropic/claude-haiku-4-5");
    expect(r.reason).toBe("router_disabled");
  });

  it("falls back to default fast model when router disabled + no LLM_MODEL", () => {
    delete process.env.LLM_ROUTER_ENABLED;
    delete process.env.LLM_MODEL;
    const r = routeModel("ซื้อนม");
    expect(r.modelId).toBe(FAST);
  });

  it("handles empty input gracefully", () => {
    const r = routeModel("");
    expect(r.modelId).toBe(FAST);
    expect(r.reason).toBe("default");
  });
});
