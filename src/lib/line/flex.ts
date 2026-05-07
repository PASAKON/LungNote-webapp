import type { LineMessage } from "./client";

// Minimal text-message stand-ins until designer-supplied Flex JSON lands
// (see wikis/50-Workflows/Designer-Handoff-LINE-Dashboard.md §2)

export function dashboardLinkMessage(url: string): LineMessage[] {
  return [
    {
      type: "text",
      text: [
        "🔗 ลิงก์ Dashboard ของคุณ",
        url,
        "",
        "ลิงก์ใช้ได้ภายใน 5 นาที, 1 ครั้งเท่านั้น.",
        "ถ้าหมดอายุ พิมพ์ 'dashboard' อีกครั้ง.",
      ].join("\n"),
    },
  ];
}

export function welcomeMessage(): LineMessage[] {
  return [
    {
      type: "text",
      text: [
        "ยินดีต้อนรับสู่ LungNote 📓",
        "จดโน้ต เช็คลิสต์ จัดระเบียบชีวิต",
        "",
        "พิมพ์ 'dashboard' เพื่อรับลิงก์เปิดเว็บ",
        "พิมพ์ 'ช่วย' เพื่อดูเมนู",
      ].join("\n"),
    },
  ];
}
