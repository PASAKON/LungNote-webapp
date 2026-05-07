"use client";

import { useState } from "react";

type FaqEntry = { q: string; a: string };

const faqs: FaqEntry[] = [
  {
    q: "LungNote ใช้ฟรีจริงไหม?",
    a: "ฟรีจริง สร้างสมุดโน้ตได้ไม่จำกัด จดได้ไม่จำกัด ฟีเจอร์หลักทั้งหมดใช้ได้ฟรี มีแพลน Pro สำหรับคนที่ต้องการ sync ข้ามอุปกรณ์และ backup อัตโนมัติ",
  },
  {
    q: "ใช้ได้บนอุปกรณ์อะไรบ้าง?",
    a: "ใช้ได้ทั้งบน iOS, Android, และ Web browser เปิดจดได้ทุกที่ ทั้งบนมือถือ แท็บเล็ต และคอมพิวเตอร์",
  },
  {
    q: "โน้ตจะหายไหมถ้าเปลี่ยนมือถือ?",
    a: "ไม่หาย สมัคร LungNote ด้วยอีเมลหรือ Google Account แล้วโน้ตทั้งหมดจะ sync อัตโนมัติ เปลี่ยนเครื่องก็ login แล้วเจอทุกอย่างเหมือนเดิม",
  },
  {
    q: "ต่างจากแอปจดโน้ตอื่นยังไง?",
    a: "LungNote ออกแบบมาเฉพาะสำหรับนักเรียนไทย — รองรับภาษาไทย 100% ฟอนต์ลายมือสวย ไม่มีฟีเจอร์รกรุงรัง เปิดมาก็จดได้เลย ไม่ต้องเสียเวลาเรียนรู้",
  },
  {
    q: "ข้อมูลปลอดภัยไหม?",
    a: "ปลอดภัย โน้ตทั้งหมดเข้ารหัสระหว่างส่งข้อมูล (TLS) และเก็บบน cloud ที่มีการเข้ารหัสแบบ at-rest เราไม่อ่านโน้ตของคุณ ไม่ขายข้อมูล ไม่มีโฆษณา",
  },
  {
    q: "มีแพลนสำหรับโรงเรียนไหม?",
    a: "มี! แพลน Education สำหรับโรงเรียนและมหาวิทยาลัย ครูจัดการห้องเรียนได้ นักเรียนแชร์โน้ตกันได้ ติดต่อทีมขายได้ที่ school@lungnote.app",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="faq wrap" id="faq">
      <div className="faq-header">
        <div className="section-label">~ คำถามที่พบบ่อย ~</div>
        <h2 className="section-title">มีคำถามไหม?</h2>
      </div>
      <div className="faq-list">
        {faqs.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={item.q} className={`faq-item${isOpen ? " open" : ""}`}>
              <button
                type="button"
                className="faq-q"
                aria-expanded={isOpen}
                onClick={() => setOpenIndex(isOpen ? null : i)}
              >
                {item.q}
                <svg
                  className="arrow"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div className="faq-a">
                <p>{item.a}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
