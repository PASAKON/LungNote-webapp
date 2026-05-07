import { NextResponse, type NextRequest } from "next/server";
import { verifySignature } from "@/lib/line/verify";
import { replyMessage } from "@/lib/line/client";
import { generateChatReply } from "@/lib/ai/reply";
import type {
  LineEvent,
  LineWebhookBody,
  LineTextMessageEvent,
  LineFollowEvent,
} from "@/lib/line/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WELCOME_MESSAGE =
  "ยินดีต้อนรับสู่ LungNote 📓\nจดโน้ต เช็คลิสต์ จัดระเบียบชีวิต\n\n💡 ข้อความของคุณอาจถูกประมวลผลโดย AI เพื่อช่วยตอบ";

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
    return replyMessage(ev.replyToken, [{ type: "text", text: WELCOME_MESSAGE }]);
  }

  return null;
}

async function handleText(ev: LineTextMessageEvent): Promise<unknown> {
  const text = ev.message.text.trim();

  // 1. Try regex first (free, deterministic)
  const regexReply = matchRegex(text);
  if (regexReply !== null) {
    return replyMessage(ev.replyToken, [{ type: "text", text: regexReply }]);
  }

  // 2. AI path (v0: stateless; no rate limit)
  const userId =
    ev.source.type === "user" ? ev.source.userId : ev.source.userId ?? "anonymous";
  const aiResult = await generateChatReply(userId, text);

  const replyText = aiResult.ok
    ? aiResult.text
    : `รับข้อความแล้ว: "${text}"\nพิมพ์ 'ช่วย' เพื่อดูคำสั่ง`;

  return replyMessage(ev.replyToken, [{ type: "text", text: replyText }]);
}

function matchRegex(text: string): string | null {
  const lower = text.toLowerCase();
  if (/(สวัสดี|hello|hi)/i.test(lower)) {
    return "สวัสดีครับ! ผมคือ LungNote bot 📓\nพิมพ์ 'ช่วย' เพื่อดูคำสั่ง";
  }
  if (/(ช่วย|help|menu)/i.test(lower)) {
    return [
      "คำสั่งที่ใช้ได้:",
      "• สวัสดี — ทักทาย",
      "• ช่วย — แสดงเมนู",
      "• เว็บ — ลิงก์ไปเว็บ",
      "• เกี่ยวกับ — เกี่ยวกับ LungNote",
    ].join("\n");
  }
  if (/(เว็บ|web|site|link)/i.test(lower)) {
    return "เปิดที่ https://lungnote.com 🌐";
  }
  if (/(เกี่ยว|about)/i.test(lower)) {
    return "LungNote — แอปจดโน้ตเรียบง่ายสำหรับนักเรียนไทย\nhttps://lungnote.com";
  }
  return null;
}
