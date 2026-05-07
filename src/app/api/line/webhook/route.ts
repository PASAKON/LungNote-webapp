import { NextResponse, type NextRequest } from "next/server";
import { verifySignature } from "@/lib/line/verify";
import { replyMessage } from "@/lib/line/client";
import type {
  LineEvent,
  LineWebhookBody,
  LineTextMessageEvent,
  LineFollowEvent,
} from "@/lib/line/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function handleEvent(event: LineEvent): Promise<void> {
  if (event.type === "message") {
    const ev = event as LineTextMessageEvent;
    if (ev.message?.type === "text") {
      await handleText(ev);
    }
    return;
  }

  if (event.type === "follow") {
    const ev = event as LineFollowEvent;
    await replyMessage(ev.replyToken, [
      {
        type: "text",
        text: "ยินดีต้อนรับสู่ LungNote 📓\nจดโน้ต เช็คลิสต์ จัดระเบียบชีวิต",
      },
    ]);
    return;
  }
}

async function handleText(ev: LineTextMessageEvent): Promise<void> {
  const text = ev.message.text.trim();
  const reply = buildReply(text);
  await replyMessage(ev.replyToken, [{ type: "text", text: reply }]);
}

function buildReply(text: string): string {
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
  return `รับข้อความแล้ว: "${text}"\nพิมพ์ 'ช่วย' เพื่อดูคำสั่ง`;
}
