import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
import { chatCompletion } from "@/lib/ai/client";
import { loadMemory, saveMemory } from "@/lib/ai/memory";
import { executeToolCall } from "@/lib/ai/tools";

const mockedChat = vi.mocked(chatCompletion);
const mockedLoad = vi.mocked(loadMemory);
const mockedSave = vi.mocked(saveMemory);
const mockedExec = vi.mocked(executeToolCall);

beforeEach(() => {
  mockedChat.mockReset();
  mockedLoad.mockReset();
  mockedSave.mockReset();
  mockedExec.mockReset();
  mockedLoad.mockResolvedValue([]);
  mockedSave.mockResolvedValue(undefined);
});
afterEach(() => vi.clearAllMocks());

function makeCall(name: string, id = `call-${name}`) {
  return {
    id,
    type: "function" as const,
    function: { name, arguments: "{}" },
  };
}

describe("toolSummary persistence", () => {
  it("passes undefined toolSummary when no tools were called", async () => {
    mockedChat.mockResolvedValueOnce({
      text: "plain answer",
      toolCalls: null,
      model: "x",
      latencyMs: 1,
      tokensIn: 1,
      tokensOut: 1,
      costEstimate: 0,
    });

    await generateChatReply("U-1", "hi");

    await new Promise((r) => setTimeout(r, 0));
    expect(mockedSave).toHaveBeenCalledTimes(1);
    const args = mockedSave.mock.calls[0];
    expect(args[1]).toEqual([]);
    expect(args[2]).toBe("hi");
    expect(args[3]).toBe("plain answer");
    expect(args[4]).toBeUndefined();
  });

  it("builds toolSummary as name×count, sorted alphabetically", async () => {
    mockedChat.mockResolvedValueOnce({
      text: "",
      toolCalls: [
        makeCall("save_memory", "c1"),
        makeCall("list_pending", "c2"),
        makeCall("save_memory", "c3"),
      ],
      model: "x",
      latencyMs: 1,
      tokensIn: 1,
      tokensOut: 1,
      costEstimate: 0,
    });
    mockedChat.mockResolvedValueOnce({
      text: "done",
      toolCalls: null,
      model: "x",
      latencyMs: 1,
      tokensIn: 1,
      tokensOut: 1,
      costEstimate: 0,
    });

    mockedExec.mockResolvedValue({
      tool_call_id: "any",
      content: '{"ok":true}',
    });

    await generateChatReply("U-2", "save these");

    await new Promise((r) => setTimeout(r, 0));
    const toolSummary = mockedSave.mock.calls[0][4];
    expect(toolSummary).toBe("[tools] list_pending×1, save_memory×2");
  });

  it("accumulates tool names across multiple iterations", async () => {
    mockedChat.mockResolvedValueOnce({
      text: "",
      toolCalls: [makeCall("list_pending", "a1")],
      model: "x",
      latencyMs: 1,
      tokensIn: 1,
      tokensOut: 1,
      costEstimate: 0,
    });
    mockedChat.mockResolvedValueOnce({
      text: "",
      toolCalls: [
        makeCall("complete_by_position", "b1"),
        makeCall("complete_by_position", "b2"),
      ],
      model: "x",
      latencyMs: 1,
      tokensIn: 1,
      tokensOut: 1,
      costEstimate: 0,
    });
    mockedChat.mockResolvedValueOnce({
      text: "ทำเสร็จแล้ว",
      toolCalls: null,
      model: "x",
      latencyMs: 1,
      tokensIn: 1,
      tokensOut: 1,
      costEstimate: 0,
    });

    mockedExec.mockResolvedValue({
      tool_call_id: "any",
      content: '{"ok":true}',
    });

    await generateChatReply("U-3", "do it");

    await new Promise((r) => setTimeout(r, 0));
    const toolSummary = mockedSave.mock.calls[0][4];
    expect(toolSummary).toBe(
      "[tools] complete_by_position×2, list_pending×1",
    );
  });
});
