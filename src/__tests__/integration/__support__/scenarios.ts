/**
 * Agent QA scenarios.
 *
 * Each scenario describes one LINE turn. Runner sets up the mock state,
 * sends `userText` through runAgent, then checks:
 *   - which tools were called (names + arg patterns)
 *   - what the final reply text looks like (regex match)
 *   - mock DB side effects (rows added/changed)
 *
 * Don't pin reply text exactly — the model varies. Match on patterns.
 */
import type { MockTodo } from "./mock-supabase";

export type ScenarioAssertion = {
  /** Expected tool calls. Order matters across iterations but parallel
   *  calls within one iter can be in any order. */
  toolCalls?: Array<{
    name: string;
    /** Args matcher: function gets the parsed args, returns boolean. */
    argsMatch?: (args: Record<string, unknown>) => boolean;
  }>;
  /** Regex the final reply text must match. */
  replyMatches?: RegExp;
  /** Regex the final reply text must NOT match. */
  replyMustNotMatch?: RegExp;
  /** Custom assertion against final mock state. */
  finalState?: (todos: MockTodo[]) => void;
  /** Max latency ms (real LLM call). Default 15s. */
  maxLatencyMs?: number;
};

export type Scenario = {
  name: string;
  /** Optional setup: returns initial todos to seed. */
  seedTodos?: () => MockTodo[];
  /** Optional conversation history seeded into the LINE user's memory store
   *  (lungnote_conversation_memory) before the turn runs. Used to simulate
   *  pollution / stale list replies. */
  seedMemory?: () => Array<{ role: "user" | "assistant"; content: string }>;
  /** What the user types. */
  userText: string;
  /** Expectations. */
  expect: ScenarioAssertion;
};

const USER_ID = "11111111-1111-1111-1111-111111111111";
const NOTE_ID = "22222222-2222-2222-2222-222222222222";
const LINE_USER_ID = "U_test_admin_1234567890";

export const TEST_LINE_USER_ID = LINE_USER_ID;
export const TEST_USER_ID = USER_ID;
export const TEST_INBOX_NOTE_ID = NOTE_ID;

function todo(text: string, opts: Partial<MockTodo> = {}): MockTodo {
  const now = new Date().toISOString();
  return {
    id: opts.id ?? crypto.randomUUID(),
    user_id: USER_ID,
    note_id: NOTE_ID,
    text,
    done: false,
    position: 0,
    due_at: null,
    due_text: null,
    source: "chat",
    created_at: now,
    updated_at: now,
    ...opts,
  };
}

export const SCENARIOS: Scenario[] = [
  {
    name: "greeting → no tool, polite reply",
    userText: "สวัสดี",
    expect: {
      toolCalls: [],
      replyMatches: /สวัสดี|hi|hello/i,
    },
  },
  {
    name: "ambiguous single word 'ทดสอบ' → ASK, do not save",
    userText: "ทดสอบ",
    expect: {
      toolCalls: [],
      replyMatches: /ทดสอบ|ลองพิมพ์|รายละเอียด|งานค้าง|จดเตือน|พิมพ์/,
      replyMustNotMatch: /^บันทึกแล้ว/,
      finalState: (todos) => {
        if (todos.length !== 0) {
          throw new Error(
            `expected no todos saved, got ${todos.length}: ${JSON.stringify(todos.map((t) => t.text))}`,
          );
        }
      },
    },
  },
  {
    // Production bug regression: even after PR #37 prompt fix, conversation
    // memory polluted with past "ทดสอบ → บันทึก" turns made Gemini keep
    // saving. PR adds a code-level block in save_memory so this can't
    // happen even if the model tries.
    name: "'ทดสอบ' BLOCKED at tool level (no save even if model tries)",
    userText: "ทดสอบ",
    expect: {
      // We don't care if AI tries save_memory — code blocks it.
      // We DO care that the final todos are empty.
      replyMustNotMatch: /^บันทึกแล้ว/,
      finalState: (todos) => {
        if (todos.length !== 0) {
          throw new Error(
            `expected NO save (code-level block), got: ${todos.map((t) => t.text).join(",")}`,
          );
        }
      },
    },
  },
  {
    name: "explicit save with date",
    userText: "พรุ่งนี้ส่งการบ้านฟิสิกส์",
    expect: {
      toolCalls: [
        {
          name: "save_memory",
          argsMatch: (a) =>
            typeof a.text === "string" &&
            /ส่งการบ้าน|ฟิสิกส์/.test(a.text) &&
            (a.due_at === undefined ||
              a.due_at === null ||
              /\d{4}-\d{2}-\d{2}/.test(String(a.due_at))),
        },
      ],
      replyMatches: /บันทึก|พรุ่งนี้|✓/,
    },
  },
  {
    name: "list pending — read-eager",
    seedTodos: () => [
      todo("ส่งงานวันจันทร์"),
      todo("ซื้อนม"),
      todo("ประชุมทีม", { due_at: "2026-05-15T02:00:00Z", due_text: "วันศุกร์" }),
    ],
    userText: "งานค้างไหม",
    expect: {
      toolCalls: [{ name: "list_pending" }],
      replyMatches: /1\.|รายการ|ส่งงาน|ซื้อนม|ประชุม/,
    },
  },
  {
    name: "delete by position 'ลบ 2' — auto-list inside tool",
    seedTodos: () => [
      todo("ส่งงาน"),
      todo("ซื้อนม"),
      todo("โทรหาแม่"),
    ],
    userText: "ลบ 2",
    expect: {
      toolCalls: [
        {
          name: "delete_by_position",
          argsMatch: (a) => a.position === 2,
        },
      ],
      replyMatches: /ลบ|✓|ซื้อนม/,
      finalState: (todos) => {
        const remaining = todos.map((t) => t.text).sort();
        if (remaining.length !== 2 || !remaining.includes("ส่งงาน") ||
            !remaining.includes("โทรหาแม่")) {
          throw new Error(
            `expected only ส่งงาน+โทรหาแม่ remaining, got: ${remaining.join(", ")}`,
          );
        }
      },
    },
  },
  {
    name: "delete multi 'ลบ 1 กับ 3'",
    seedTodos: () => [
      todo("A"),
      todo("B"),
      todo("C"),
      todo("D"),
    ],
    userText: "ลบ 1 กับ 3",
    expect: {
      toolCalls: [
        { name: "delete_by_position", argsMatch: (a) => a.position === 1 },
        { name: "delete_by_position", argsMatch: (a) => a.position === 3 },
      ],
      finalState: (todos) => {
        const remaining = todos.map((t) => t.text).sort();
        if (remaining.length !== 2 || !remaining.includes("B") || !remaining.includes("D")) {
          throw new Error(`expected B+D, got ${remaining.join(",")}`);
        }
      },
    },
  },
  {
    name: "complete by name match",
    seedTodos: () => [
      todo("งาน A"),
      todo("งาน B"),
    ],
    userText: "งาน B เสร็จแล้ว",
    expect: {
      // list_pending may or may not be explicit (server auto-lists).
      // Require at least: complete_by_position with position 2 (งาน B).
      toolCalls: [
        {
          name: "complete_by_position",
          argsMatch: (a) => a.position === 2,
        },
      ],
      replyMatches: /เสร็จ|✓|B/,
      finalState: (todos) => {
        const b = todos.find((t) => t.text === "งาน B");
        if (!b || !b.done) {
          throw new Error(`expected งาน B to be done=true, got ${b?.done}`);
        }
      },
    },
  },
  {
    name: "send dashboard link",
    userText: "เปิดเว็บ",
    expect: {
      toolCalls: [{ name: "send_dashboard_link" }],
      replyMatches: /lungnote\.com|auth\/line|t=/,
    },
  },
  {
    name: "off-topic refusal",
    userText: "อธิบาย Pythagorean theorem หน่อย",
    expect: {
      toolCalls: [],
      replyMatches: /ขอโทษ|LungNote|note|จดโน้ต/i,
    },
  },
  {
    // Production bug regression: AI replied with a stale 6-item list when
    // DB only had 4 items, because previous numbered-list replies sat in
    // conversation memory. Fix: memory.ts now summarizes past list replies
    // so the model can't recite stale items.
    name: "polluted memory: 'ลิสรายการ' must call list_pending FRESH",
    seedTodos: () => [todo("X1"), todo("X2"), todo("X3"), todo("X4")],
    seedMemory: () => [
      { role: "user", content: "ลิสรายการ" },
      {
        role: "assistant",
        content:
          "นี่คือรายการที่ต้องทำนะ:\n\n1. STALE_A\n2. STALE_B\n3. STALE_C\n4. STALE_D\n5. STALE_E\n6. STALE_F",
      },
    ],
    userText: "ลิสรายการ",
    expect: {
      toolCalls: [{ name: "list_pending" }],
      // Reply must reflect the LIVE list (X1..X4), not the stale 6-item one.
      replyMustNotMatch: /STALE_[A-F]/,
      replyMatches: /X1|X2|X3|X4/,
    },
  },
  {
    name: "explicit save with prefix 'จด ซื้อนม'",
    userText: "จด ซื้อนม",
    expect: {
      toolCalls: [
        {
          name: "save_memory",
          argsMatch: (a) => typeof a.text === "string" && /ซื้อนม/.test(a.text),
        },
      ],
      replyMatches: /บันทึก|✓|ซื้อนม/,
    },
  },
];
