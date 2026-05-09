import { NextResponse, type NextRequest } from "next/server";
import { verifySignature } from "@/lib/line/verify";
import { replyMessage, displayLoadingAnimation } from "@/lib/line/client";
import { generateChatReply } from "@/lib/ai/reply";
import { runAgent, TurnContext } from "@/lib/agent/runtime";
import { loadMemory, saveMemory } from "@/lib/ai/memory";
import { saveMemoryFromLine } from "@/lib/memory/save";
import { listPendingFromLine } from "@/lib/memory/list";
import { dashboardLinkMessage, welcomeMessage } from "@/lib/line/flex";
import { mintToken } from "@/lib/auth/line-link";
import { TraceCollector } from "@/lib/observability/trace";
import type {
  LineEvent,
  LineWebhookBody,
  LineTextMessageEvent,
  LineFollowEvent,
} from "@/lib/line/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL = "https://lungnote.com";
const DASHBOARD_KEYWORDS = /^(dashboard|dash|เปิด|ลิงก์|link|\/login|\/dash)$/i;
// Memory capture prefix (ADR-0012, broadened by ADR-0012 follow-up):
// Single-word prefix: "จด <text>", "บันทึก <text>", "note <text>",
//   "save <text>", "todo <text>", "ทำ <text>", "เตือน <text>", "อย่าลืม <text>".
const MEMORY_PREFIX_SINGLE =
  /^(?:จด|บันทึก|note|save|todo|ทำ|เตือน|อย่าลืม)\s+([\s\S]+)$/i;
// Compound prefix: "เพิ่ม(สิ่งที่ต้องทำ|todo|งาน) <text>" — matches what
// users naturally type when they think of LungNote as a todo app. The space
// between "เพิ่ม" and the noun is optional because Thai often elides it.
const MEMORY_PREFIX_COMPOUND =
  /^เพิ่ม\s*(?:สิ่งที่ต้องทำ|todo|งาน|todos)\s+([\s\S]+)$/i;
// List-pending intent: user asks to see what's pending. Matches whole-message
// queries; no capture group — we just trigger the list handler.
const LIST_PENDING_INTENT =
  /^(?:.*มีงานอะไร.*|.*งานค้าง.*|ดู\s*(?:งาน|โน้ต|โน๊ต|todo).*|todo(?:\s+(?:อะไร|มีไหม|มีอะไร).*)?|รายการ|list)$/i;

export async function POST(req: NextRequest) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "missing secret" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");
  const valid = await verifySignature(rawBody, signature, secret);

  if (!valid) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody) as LineWebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  await Promise.allSettled(body.events.map(handleEvent));

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    note: "LINE webhook endpoint — POST only with x-line-signature",
  });
}

async function handleEvent(event: LineEvent): Promise<unknown> {
  if (event.type === "message") {
    const ev = event as LineTextMessageEvent;
    if (ev.message?.type === "text") return handleText(ev);
    return null;
  }

  if (event.type === "follow") {
    const ev = event as LineFollowEvent;
    return replyMessage(ev.replyToken, welcomeMessage());
  }

  if (event.type === "postback") {
    const ev = event as LineEvent & {
      replyToken: string;
      source: { userId?: string };
      postback?: { data?: string };
    };
    const data = ev.postback?.data ?? "";
    const userId = ev.source?.userId;
    if (!userId) return null;

    if (data.includes("action=open_dashboard")) {
      return sendDashboardLink(ev.replyToken, userId);
    }
    if (data.includes("action=help")) {
      return replyMessage(ev.replyToken, [{ type: "text", text: helpText() }]);
    }
    return null;
  }

  return null;
}

/**
 * Routing strategy is controlled by AI_AGENT_MODE env:
 *   "true"  → all messages go to the AI (with tools); regex shortcuts disabled
 *   "false" → legacy regex shortcuts run first, AI fallback last
 * Default = "true" (full agent). Toggle to "false" if AI cost / latency
 * spikes or upstream LLM is down — shortcuts give a deterministic fallback.
 */
function isAgentMode(): boolean {
  return (process.env.AI_AGENT_MODE ?? "true") !== "false";
}

async function handleText(ev: LineTextMessageEvent): Promise<unknown> {
  const text = ev.message.text.trim();
  const userId = ev.source.type === "user" ? ev.source.userId : undefined;
  const trace = new TraceCollector(ev.message.id, userId, text);

  // Fire the LINE typing indicator immediately so the user sees "..." while
  // the AI / DB work runs. Best-effort: failure is silent; the dots auto-
  // clear when our reply lands or after 20s. Skip if no userId (group/room).
  if (userId) {
    void displayLoadingAnimation(userId, 20).catch((err: unknown) => {
      console.error("displayLoadingAnimation failed", { userId, err });
    });
  }

  if (isAgentMode()) {
    return handleTextAgent(ev, text, userId, trace);
  }
  return handleTextLegacy(ev, text, userId, trace);
}

/**
 * Full agent mode (v2) — Vercel AI SDK + custom TurnContext + position-aware
 * tools. Each turn instantiates a fresh TurnContext so the agent's working
 * memory (cached pending/done lists) cannot leak across users or turns.
 */
async function handleTextAgent(
  ev: LineTextMessageEvent,
  text: string,
  userId: string | undefined,
  trace: TraceCollector,
): Promise<unknown> {
  trace.step("path_ai");
  const ctx = new TurnContext(userId ?? null, trace);
  const aiResult = await runAgent(text, ctx);
  const replyText = aiResult.ok
    ? aiResult.text
    : `ขอโทษ ระบบขัดข้อง — ลองอีกครั้งภายหลังนะ`;

  // Multi-bubble: flush each bubble as its own LINE TextMessage in a
  // single reply call (LINE caps at 5; agent enforces). If runAgent
  // failed, fall back to the canned error as one bubble.
  const bubbleTexts = aiResult.ok ? aiResult.bubbles : [replyText];
  const replyRes = await replyMessage(
    ev.replyToken,
    bubbleTexts.map((text) => ({ type: "text", text })),
  );
  trace.step("reply_sent", {
    status: replyRes.status,
    ok: replyRes.ok,
    bubble_count: bubbleTexts.length,
  });
  trace.finalize({
    path: "ai",
    replyText,
    meta: {
      ...(aiResult.ok
        ? {
            model: aiResult.meta.model,
            tokens_in: aiResult.meta.tokensIn,
            tokens_out: aiResult.meta.tokensOut,
            cost_usd: aiResult.meta.costEstimate,
          }
        : {}),
      reply_status: replyRes.status,
      reply_ok: replyRes.ok,
      ...(replyRes.detail ? { reply_detail: replyRes.detail.slice(0, 500) } : {}),
    },
    error: !aiResult.ok
      ? `${aiResult.reason}: ${aiResult.error ?? ""}`
      : !replyRes.ok
        ? `reply_failed: HTTP ${replyRes.status} ${replyRes.detail ?? ""}`.slice(0, 500)
        : undefined,
    aiIterations: trace.aiIterations,
  });
  return null;
}

/**
 * Legacy mode — keep regex shortcuts + AI fallback. Used when AI_AGENT_MODE
 * is explicitly disabled (rollback safety net).
 */
async function handleTextLegacy(
  ev: LineTextMessageEvent,
  text: string,
  userId: string | undefined,
  trace: TraceCollector,
): Promise<unknown> {
  if (DASHBOARD_KEYWORDS.test(text) && userId) {
    trace.step("path_dashboard");
    const out = sendDashboardLink(ev.replyToken, userId);
    trace.finalize({ path: "dashboard" });
    return out;
  }

  if (LIST_PENDING_INTENT.test(text) && userId) {
    trace.step("path_list");
    return handleMemoryList(ev.replyToken, userId, text, trace);
  }

  const memoryMatch =
    MEMORY_PREFIX_SINGLE.exec(text) ?? MEMORY_PREFIX_COMPOUND.exec(text);
  if (memoryMatch && userId) {
    const memoryText = memoryMatch[1].trim();
    if (memoryText) {
      trace.step("path_memory", {
        prefix_kind: MEMORY_PREFIX_SINGLE.test(text) ? "single" : "compound",
      });
      return handleMemoryCreate(ev.replyToken, userId, memoryText, text, trace);
    }
  }

  const regexReply = matchRegex(text);
  if (regexReply !== null) {
    trace.step("path_regex");
    const r = await replyMessage(ev.replyToken, [
      { type: "text", text: regexReply },
    ]);
    trace.step("reply_sent", { status: r.status, ok: r.ok });
    trace.finalize({
      path: "regex",
      replyText: regexReply,
      meta: { reply_status: r.status, reply_ok: r.ok },
      error: !r.ok ? `reply_failed: HTTP ${r.status}` : undefined,
    });
    return null;
  }

  trace.step("path_ai");
  const aiUserId = userId ?? "anonymous";
  const aiResult = await generateChatReply(aiUserId, text, trace);
  const replyText = aiResult.ok
    ? aiResult.text
    : `รับข้อความแล้ว: "${text}"\nพิมพ์ 'ช่วย' เพื่อดูคำสั่ง`;

  const replyRes2 = await replyMessage(ev.replyToken, [
    { type: "text", text: replyText },
  ]);
  trace.step("reply_sent", { status: replyRes2.status, ok: replyRes2.ok });
  trace.finalize({
    path: "ai",
    replyText,
    meta: {
      ...(aiResult.ok
        ? {
            model: aiResult.meta.model,
            tokens_in: aiResult.meta.tokensIn,
            tokens_out: aiResult.meta.tokensOut,
            cost_usd: aiResult.meta.costEstimate,
          }
        : {}),
      reply_status: replyRes2.status,
      reply_ok: replyRes2.ok,
      ...(replyRes2.detail ? { reply_detail: replyRes2.detail.slice(0, 500) } : {}),
    },
    error: !aiResult.ok
      ? `${aiResult.reason}: ${aiResult.error ?? ""}`
      : !replyRes2.ok
        ? `reply_failed: HTTP ${replyRes2.status} ${replyRes2.detail ?? ""}`.slice(0, 500)
        : undefined,
    aiIterations: trace.aiIterations,
  });
  return null;
}

async function handleMemoryCreate(
  replyToken: string,
  lineUserId: string,
  memoryText: string,
  fullUserMessage: string,
  trace: TraceCollector,
): Promise<unknown> {
  const result = await saveMemoryFromLine(lineUserId, memoryText);
  trace.step("memory_save_result", { ok: result.ok, ...(result.ok ? { has_due: !!result.dueAt } : { reason: result.reason }) });

  let replyText: string;
  if (!result.ok && result.reason === "not_linked") {
    replyText =
      "ต้องลิงก์ account ก่อนถึงจะจดได้\nพิมพ์ 'dashboard' เพื่อรับลิงก์";
  } else if (!result.ok && result.reason === "empty") {
    replyText = "ข้อความว่างเปล่า ลองพิมพ์เนื้อหาที่จะจดด้วยนะ";
  } else if (!result.ok) {
    replyText = "ขอโทษ จดไม่สำเร็จ ลองอีกครั้งภายหลังนะ";
  } else {
    const dueLine = formatDueLine(result.dueAt, result.dueText);
    const head = `บันทึกแล้ว ✓ "${result.text}"`;
    replyText = dueLine
      ? `${head}\n${dueLine}\nดูที่ ${SITE_URL}/dashboard/todo`
      : `${head}\nดูที่ ${SITE_URL}/dashboard/todo`;
  }

  // Persist this turn into conversation memory so the AI fallback path remembers
  // capture context (e.g. user later asks "เมื่อกี้พิมไรไป"). Best-effort —
  // memory failure must not block the reply.
  void persistTurn(lineUserId, fullUserMessage, replyText);

  const r = await replyMessage(replyToken, [{ type: "text", text: replyText }]);
  trace.step("reply_sent", { status: r.status, ok: r.ok });
  trace.finalize({
    path: "memory",
    replyText,
    meta: { reply_status: r.status, reply_ok: r.ok },
    error: !result.ok
      ? `${result.reason}: ${result.error ?? ""}`
      : !r.ok
        ? `reply_failed: HTTP ${r.status} ${r.detail ?? ""}`.slice(0, 500)
        : undefined,
  });
  return null;
}

async function handleMemoryList(
  replyToken: string,
  lineUserId: string,
  fullUserMessage: string,
  trace: TraceCollector,
): Promise<unknown> {
  const result = await listPendingFromLine(lineUserId);
  trace.step("memory_list_result", { ok: result.ok, ...(result.ok ? { count: result.items.length } : { reason: result.reason }) });

  let replyText: string;
  if (!result.ok && result.reason === "not_linked") {
    replyText =
      "ต้องลิงก์ account ก่อนถึงจะดูงานได้\nพิมพ์ 'dashboard' เพื่อรับลิงก์";
  } else if (!result.ok) {
    replyText = "ขอโทษ ดึงงานไม่สำเร็จ ลองอีกครั้งภายหลังนะ";
  } else if (result.items.length === 0) {
    replyText = "ไม่มีงานค้างเลย — ดีมาก! 🎉";
  } else {
    const lines = result.items.map((it, idx) => {
      const due = formatDueShort(it.due_at);
      return due
        ? `${idx + 1}. ${it.text} — ⏰ ${due}`
        : `${idx + 1}. ${it.text}`;
    });
    const header = `📋 งานค้าง ${result.items.length} รายการ`;
    const footer = `\nดูทั้งหมดที่ ${SITE_URL}/dashboard/todo`;
    replyText = [header, ...lines].join("\n") + footer;
  }

  void persistTurn(lineUserId, fullUserMessage, replyText);
  const r = await replyMessage(replyToken, [{ type: "text", text: replyText }]);
  trace.step("reply_sent", { status: r.status, ok: r.ok });
  trace.finalize({
    path: "list",
    replyText,
    meta: {
      ...(result.ok ? { item_count: result.items.length } : {}),
      reply_status: r.status,
      reply_ok: r.ok,
    },
    error: !result.ok
      ? `${result.reason}: ${result.error ?? ""}`
      : !r.ok
        ? `reply_failed: HTTP ${r.status} ${r.detail ?? ""}`.slice(0, 500)
        : undefined,
  });
  return null;
}

function formatDueShort(iso: string | null): string | null {
  if (!iso) return null;
  const due = new Date(iso);
  const now = new Date();
  if (Number.isNaN(due.getTime())) return null;

  const dayMs = 1000 * 60 * 60 * 24;
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((dueDay - today) / dayMs);

  if (diff < 0) return `เลย ${Math.abs(diff)} วัน`;
  if (diff === 0) return "วันนี้";
  if (diff === 1) return "พรุ่งนี้";
  if (diff <= 7) return `อีก ${diff} วัน`;
  return due.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

function formatDueLine(dueAt: string | null, dueText: string | null): string | null {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return null;
  const formatted = d.toLocaleString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
  return dueText
    ? `⏰ ${dueText} (${formatted})`
    : `⏰ ${formatted}`;
}

async function persistTurn(
  lineUserId: string,
  userMessage: string,
  assistantReply: string,
): Promise<void> {
  try {
    const prior = await loadMemory(lineUserId);
    await saveMemory(lineUserId, prior, userMessage, assistantReply);
  } catch (err) {
    console.error("persistTurn failed", { lineUserId, err });
  }
}

async function sendDashboardLink(
  replyToken: string,
  lineUserId: string,
): Promise<void> {
  try {
    const { token } = await mintToken(lineUserId);
    const url = `${SITE_URL}/auth/line?t=${token}`;
    await replyMessage(replyToken, dashboardLinkMessage(url));
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    await replyMessage(replyToken, [
      {
        type: "text",
        text: `เกิดข้อผิดพลาด สร้างลิงก์ไม่สำเร็จ — ลองอีกครั้งภายหลัง\n(${detail})`,
      },
    ]);
  }
}

function matchRegex(text: string): string | null {
  const lower = text.toLowerCase();
  if (/(สวัสดี|hello|hi)/i.test(lower)) {
    return "สวัสดีครับ! ผมคือ LungNote bot 📓\nพิมพ์ 'dashboard' เพื่อเปิดเว็บ\nพิมพ์ 'ช่วย' เพื่อดูคำสั่ง";
  }
  if (/(ช่วย|help|menu)/i.test(lower)) {
    return helpText();
  }
  if (/(เว็บ|web|site)/i.test(lower)) {
    return `เว็บ: ${SITE_URL} 🌐\n(ต้องการเข้า dashboard ส่วนตัว — พิมพ์ 'dashboard')`;
  }
  if (/(เกี่ยว|about)/i.test(lower)) {
    return `LungNote — แอปจดโน้ตเรียบง่ายสำหรับนักเรียนไทย\n${SITE_URL}`;
  }
  return null;
}

function helpText(): string {
  return [
    "คำสั่งที่ใช้ได้:",
    "• dashboard — รับลิงก์เปิด Dashboard",
    "• จด/บันทึก/todo/ทำ/เตือน/อย่าลืม <ข้อความ> — บันทึกความจำ",
    "  ใส่วันที่ก็ได้ เช่น 'เตือน พรุ่งนี้ส่งการบ้านฟิสิกส์'",
    "  หรือพิมพ์ 'เพิ่มสิ่งที่ต้องทำ <ข้อความ>'",
    "• งานค้าง / ดูงาน / ดูโน้ต — ดูงานที่ค้างอยู่",
    "• สวัสดี — ทักทาย",
    "• เว็บ — ลิงก์ไปเว็บ",
    "• เกี่ยวกับ — เกี่ยวกับ LungNote",
    "",
    "💡 ข้อความอื่นๆ จะถูก AI ช่วยตอบ (จำได้ 5 ข้อความล่าสุด)",
  ].join("\n");
}
