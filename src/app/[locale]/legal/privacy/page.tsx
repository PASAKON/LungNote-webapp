import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, type Locale } from "@/i18n/config";

export const dynamic = "force-static";
export const revalidate = 86400;

export function generateStaticParams() {
  return [{ locale: "th" }, { locale: "en" }];
}

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const title = locale === "th" ? "นโยบายความเป็นส่วนตัว" : "Privacy Policy";
  return {
    title,
    description:
      locale === "th"
        ? "นโยบายความเป็นส่วนตัวของ LungNote — เก็บข้อมูลอะไร ใช้ยังไง ลบยังไง"
        : "LungNote privacy policy — what we collect, how we use it, how to delete.",
    robots: { index: true, follow: true },
  };
}

export default async function PrivacyPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const content = locale === "th" ? CONTENT_TH : CONTENT_EN;

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "32px 20px 80px",
        fontFamily: "var(--font-body)",
        lineHeight: 1.7,
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 40,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {content.title}
      </h1>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>
        {content.lastUpdated}
      </div>

      {content.sections.map((s) => (
        <section key={s.id} style={{ marginBottom: 28 }}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 24,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            {s.heading}
          </h2>
          {s.paragraphs.map((p, i) => (
            <p key={i} style={{ fontSize: 15, marginBottom: 10 }}>
              {p}
            </p>
          ))}
          {s.bullets && (
            <ul
              style={{
                fontSize: 15,
                paddingLeft: 20,
                marginBottom: 10,
              }}
            >
              {s.bullets.map((b, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {b}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <hr
        style={{
          margin: "32px 0",
          border: "0",
          borderTop: "1px solid var(--border, #ccc)",
        }}
      />
      <div style={{ fontSize: 13, color: "var(--muted)" }}>
        <strong>{content.contactLabel}</strong>{" "}
        <a href="mailto:pass.gob1@gmail.com" style={{ color: "var(--accent)" }}>
          pass.gob1@gmail.com
        </a>
        <br />
        <LocaleSwitch currentLocale={locale} />
      </div>
    </main>
  );
}

function LocaleSwitch({ currentLocale }: { currentLocale: Locale }) {
  const other: Locale = currentLocale === "th" ? "en" : "th";
  const label = other === "th" ? "ภาษาไทย" : "English";
  return (
    <a href={`/${other}/legal/privacy`} style={{ color: "var(--accent)" }}>
      {label}
    </a>
  );
}

type Section = {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

type Content = {
  title: string;
  lastUpdated: string;
  contactLabel: string;
  sections: Section[];
};

const CONTENT_TH: Content = {
  title: "นโยบายความเป็นส่วนตัว",
  lastUpdated: "อัปเดตล่าสุด: 21 พฤษภาคม 2026",
  contactLabel: "ติดต่อ:",
  sections: [
    {
      id: "intro",
      heading: "เกี่ยวกับ LungNote",
      paragraphs: [
        "LungNote (อ่าน 'ลังโน้ต') เป็นเว็บแอปจดโน้ต เช็คลิสต์ และเตือนความจำ สำหรับนักเรียน-นักศึกษาไทย ผ่าน LINE Official Account + เว็บ dashboard ที่ lungnote.com",
        "หน้านี้อธิบายว่าเราเก็บข้อมูลอะไรของคุณ ใช้เพื่ออะไร เก็บที่ไหน และคุณลบมันได้ยังไง",
      ],
    },
    {
      id: "data-collected",
      heading: "ข้อมูลที่เราเก็บ",
      paragraphs: ["เราเก็บเฉพาะที่จำเป็นสำหรับฟีเจอร์ที่คุณใช้:"],
      bullets: [
        "บัญชี LINE: userId (สำหรับยืนยันตัวตน), displayName, รูปโปรไฟล์ — มาจาก LINE Login OAuth ตอนคุณเริ่มใช้แอป",
        "เนื้อหาที่คุณจด: ข้อความโน้ต / to-do / due date — เก็บใน Supabase Postgres ปกป้องด้วย Row-Level Security",
        "Gmail (เฉพาะถ้าคุณกด Connect Gmail): บัญชีอีเมลที่เชื่อม, message_id, header ตัดสั้น (sender domain, subject 80 ตัวอักษรแรก), AI judgement ว่าเป็น to-do หรือไม่",
        "Token Gmail: เข้ารหัส AES-256-GCM ที่ฝั่ง server ก่อนเก็บ ไม่มีใครเห็นค่า plaintext ได้นอกจาก runtime ของเรา",
        "Log การใช้งานขั้นต่ำ: เวลา sync, จำนวน todo ใหม่ — เพื่อ debug ระบบ",
      ],
    },
    {
      id: "data-not-collected",
      heading: "ข้อมูลที่เราไม่เก็บ",
      paragraphs: [],
      bullets: [
        "เนื้อหา email body แบบเต็ม — เราอ่านแค่ subject + snippet เพื่อ AI ตัดสินว่าเป็น to-do, ไม่ save ตัว body",
        "ที่อยู่อีเมลของผู้ส่ง — เราเก็บแค่ส่วน domain (เช่น <school.ac.th>) ไม่เก็บ local part",
        "ข้อมูลการเงิน บัตรเครดิต รหัสผ่าน — เราไม่ขอ ไม่ใช้",
      ],
    },
    {
      id: "how-we-use",
      heading: "เราใช้ข้อมูลทำอะไร",
      paragraphs: [],
      bullets: [
        "แสดง to-do ของคุณบน dashboard / ตอบกลับใน LINE",
        "AI (Google Gemini 2.5 Flash ผ่าน OpenRouter) ตัดสินว่า email ไหนคือ to-do ด่วน / เมลที่ต้องตอบกลับ",
        "สำรอง / กู้คืน ตอนคุณกู้บัญชี",
        "ดูแลระบบ — เช่น ตรวจ error, ดู usage trend",
      ],
    },
    {
      id: "ai-restrictions",
      heading: "ข้อจำกัด AI",
      paragraphs: [
        "แม้คุณเลือกระดับสิทธิ์ Gmail สูงสุด ('ทุกสิทธิ์') AI ของเราถูกบังคับใน code ห้ามลบเมล ห้ามย้ายเข้า Trash, ห้าม batchDelete เด็ดขาด สิทธิ์ที่ token ได้คือเพดาน ไม่ใช่ behavior",
      ],
    },
    {
      id: "third-party",
      heading: "บริการที่ใช้ร่วม",
      paragraphs: [],
      bullets: [
        "Supabase — เก็บฐานข้อมูล + auth (ดู supabase.com/privacy)",
        "Google Gmail API — อ่านเมลของคุณ (เฉพาะที่ Connect)",
        "OpenRouter / Google Gemini — AI classify email",
        "LINE Messaging API — รับส่งข้อความบอท",
        "Vercel — host webapp",
      ],
    },
    {
      id: "sharing",
      heading: "การแบ่งปันข้อมูล",
      paragraphs: [
        "เราไม่ขายข้อมูลคุณ ไม่แบ่งให้บริษัทโฆษณา ไม่แบ่งให้ data broker ใดๆ",
        "เราจะแบ่งข้อมูลเฉพาะเมื่อ: (1) คุณยินยอม, (2) มีหมายศาลที่ถูกกฎหมาย, (3) เพื่อปกป้องสิทธิ / ความปลอดภัยของผู้ใช้คนอื่น",
      ],
    },
    {
      id: "user-rights",
      heading: "สิทธิ์ของคุณ",
      paragraphs: [],
      bullets: [
        "ยกเลิกการเชื่อม Gmail ได้ทุกเมื่อที่ /dashboard/settings — token ถูกลบ + revoke ที่ Google ทันที",
        "ขอลบบัญชีทั้งหมด — เมลมาที่ pass.gob1@gmail.com เราลบใน 7 วัน",
        "ขอ export ข้อมูล — เมลขอ เราส่ง JSON ภายใน 14 วัน",
        "ขอแก้ไข — จัดการได้ผ่าน dashboard เอง",
      ],
    },
    {
      id: "security",
      heading: "ความปลอดภัย",
      paragraphs: [],
      bullets: [
        "การเชื่อมต่อทั้งหมด HTTPS / TLS 1.2+",
        "Refresh token เข้ารหัส AES-256-GCM, key เก็บใน Vercel server-only environment",
        "Database Row-Level Security — user อ่าน/เขียนเฉพาะแถวของตัวเอง",
        "เราจะแจ้งภายใน 72 ชั่วโมงถ้าเกิด data breach ที่กระทบคุณ",
      ],
    },
    {
      id: "changes",
      heading: "การเปลี่ยนแปลงนโยบาย",
      paragraphs: [
        "ถ้าเปลี่ยนนโยบายสำคัญ เราจะแจ้งผ่าน LINE OA + เว็บก่อนผลบังคับใช้ 14 วัน",
      ],
    },
  ],
};

const CONTENT_EN: Content = {
  title: "Privacy Policy",
  lastUpdated: "Last updated: 21 May 2026",
  contactLabel: "Contact:",
  sections: [
    {
      id: "intro",
      heading: "About LungNote",
      paragraphs: [
        "LungNote is a note-taking, checklist, and reminder webapp for Thai students, delivered through a LINE Official Account plus a web dashboard at lungnote.com.",
        "This page explains what we collect about you, why, where it lives, and how you can delete it.",
      ],
    },
    {
      id: "data-collected",
      heading: "What we collect",
      paragraphs: ["Only what's needed for the features you use:"],
      bullets: [
        "LINE account: userId (used as identity), display name, profile picture — received from LINE Login OAuth at first sign-in.",
        "Content you save: note text, to-do items, due dates — stored in Supabase Postgres protected by Row-Level Security.",
        "Gmail (only if you click Connect Gmail): the email address you linked, message_id, truncated headers (sender domain only, subject first 80 chars), AI judgement on whether each message is a to-do.",
        "Gmail tokens: AES-256-GCM encrypted server-side before storage. Plaintext only exists in our request runtime.",
        "Minimal operational logs: sync timestamps, todo counts — for debugging.",
      ],
    },
    {
      id: "data-not-collected",
      heading: "What we do NOT collect",
      paragraphs: [],
      bullets: [
        "Full email body — we read subject + snippet only for AI classification; the body is never stored.",
        "Sender email local parts — we keep only the domain (e.g. <school.ac.th>).",
        "Financial info, credit cards, passwords — we don't ask and don't use.",
      ],
    },
    {
      id: "how-we-use",
      heading: "How we use it",
      paragraphs: [],
      bullets: [
        "Show your todos on the dashboard / reply in LINE.",
        "AI (Google Gemini 2.5 Flash via OpenRouter) decides which emails are urgent todos or need-a-reply.",
        "Backup / restore for account recovery.",
        "Operational health — error monitoring, usage trends.",
      ],
    },
    {
      id: "ai-restrictions",
      heading: "AI restrictions",
      paragraphs: [
        "Even if you grant the highest Gmail permission tier ('Full'), our AI is hard-coded to refuse trashing or permanently deleting messages. Granted scope is a ceiling, not a behavior.",
      ],
    },
    {
      id: "third-party",
      heading: "Third-party services",
      paragraphs: [],
      bullets: [
        "Supabase — database + auth (see supabase.com/privacy).",
        "Google Gmail API — reads your inbox (only when you Connect).",
        "OpenRouter / Google Gemini — AI email classification.",
        "LINE Messaging API — bot send/receive.",
        "Vercel — webapp hosting.",
      ],
    },
    {
      id: "sharing",
      heading: "Sharing",
      paragraphs: [
        "We do not sell your data, share with advertisers, or sell to data brokers.",
        "We will share only when: (1) you consent, (2) a lawful court order requires it, (3) to protect another user's rights or safety.",
      ],
    },
    {
      id: "user-rights",
      heading: "Your rights",
      paragraphs: [],
      bullets: [
        "Disconnect Gmail at /dashboard/settings any time — token is revoked at Google and deleted from our DB immediately.",
        "Request full account deletion — email pass.gob1@gmail.com; we delete within 7 days.",
        "Request data export — email us; we send JSON within 14 days.",
        "Edit — you can edit content yourself in the dashboard.",
      ],
    },
    {
      id: "security",
      heading: "Security",
      paragraphs: [],
      bullets: [
        "All connections HTTPS / TLS 1.2+.",
        "Refresh tokens AES-256-GCM encrypted; key kept in Vercel server-only environment.",
        "Database Row-Level Security — every user reads/writes only their own rows.",
        "We will notify within 72 hours of any data breach affecting you.",
      ],
    },
    {
      id: "changes",
      heading: "Policy changes",
      paragraphs: [
        "Material changes will be announced via LINE OA + the web 14 days before they take effect.",
      ],
    },
  ],
};
