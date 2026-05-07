import { NextResponse, type NextRequest } from "next/server";
import { verifySignature } from "@/lib/line/verify";
import { replyMessage } from "@/lib/line/client";
import { generateChatReply } from "@/lib/ai/reply";
import { loadMemory, saveMemory } from "@/lib/ai/memory";
import { createNoteFromLine } from "@/lib/notes/create";
import { dashboardLinkMessage, welcomeMessage } from "@/lib/line/flex";
import { mintToken } from "@/lib/auth/line-link";
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
// Note creation prefix: "จด <content>", "บันทึก <content>", "note <content>", "save <content>".
// Content can span multiple lines (use [\s\S] not . because . won't cross newlines).
const NOTE_PREFIX = /^(?:จด|บันทึก|note|save)\s+([\s\S]+)$/i;

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

async function handleText(ev: LineTextMessageEvent): Promise<unknown> {
  const text = ev.message.text.trim();
  const userId = ev.source.type === "user" ? ev.source.userId : undefined;

  // 1. Dashboard trigger — highest priority (free, deterministic)
  if (DASHBOARD_KEYWORDS.test(text) && userId) {
    return sendDashboardLink(ev.replyToken, userId);
  }

  // 2. Note creation prefix (free regex; profile lookup + insert happens server-side)
  const noteMatch = NOTE_PREFIX.exec(text);
  if (noteMatch && userId) {
    const noteText = noteMatch[1].trim();
    if (noteText) {
      // Pass full text (incl. "จด" prefix) so memory reflects what user actually typed.
      return handleNoteCreate(ev.replyToken, userId, noteText, text);
    }
  }

  // 3. Regex commands (free, deterministic)
  const regexReply = matchRegex(text);
  if (regexReply !== null) {
    return replyMessage(ev.replyToken, [{ type: "text", text: regexReply }]);
  }

  // 4. AI fallback (now with rolling 5+5 conversation memory, see ADR-0009)
  const aiUserId = userId ?? "anonymous";
  const aiResult = await generateChatReply(aiUserId, text);
  const replyText = aiResult.ok
    ? aiResult.text
    : `รับข้อความแล้ว: "${text}"\nพิมพ์ 'ช่วย' เพื่อดูคำสั่ง`;

  return replyMessage(ev.replyToken, [{ type: "text", text: replyText }]);
}

async function handleNoteCreate(
  replyToken: string,
  lineUserId: string,
  noteText: string,
  fullUserMessage: string,
): Promise<unknown> {
  const result = await createNoteFromLine(lineUserId, noteText);

  let replyText: string;
  if (!result.ok && result.reason === "not_linked") {
    replyText =
      "ต้องลิงก์ account ก่อนถึงจะจดโน้ตได้\nพิมพ์ 'dashboard' เพื่อรับลิงก์";
  } else if (!result.ok) {
    replyText = "ขอโทษ จดโน้ตไม่สำเร็จ ลองอีกครั้งภายหลังนะ";
  } else {
    replyText = `บันทึกแล้ว ✓ "${result.title}"\nดูที่ ${SITE_URL}/dashboard`;
  }

  // Persist this turn into conversation memory so the AI fallback path remembers
  // note-creation context (e.g. user later asks "เมื่อกี้พิมไรไป"). Best-effort —
  // memory failure must not block the reply.
  void persistTurn(lineUserId, fullUserMessage, replyText);

  return replyMessage(replyToken, [{ type: "text", text: replyText }]);
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
    "• จด <ข้อความ> — บันทึกโน้ตเข้า dashboard (ต้องลิงก์ account ก่อน)",
    "• สวัสดี — ทักทาย",
    "• เว็บ — ลิงก์ไปเว็บ",
    "• เกี่ยวกับ — เกี่ยวกับ LungNote",
    "",
    "💡 ข้อความอื่นๆ จะถูก AI ช่วยตอบ (จำได้ 5 ข้อความล่าสุด)",
  ].join("\n");
}
