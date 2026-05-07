type Feature = {
  title: string;
  desc: string;
  icon: React.ReactNode;
};

const features: Feature[] = [
  {
    title: "จดโน้ตด้วยลายมือ",
    desc: "พิมพ์โน้ตแบบอิสระ รองรับภาษาไทยเต็มรูปแบบ ฟอนต์ลายมือสวยงามทำให้การจดรู้สึกเป็นธรรมชาติ",
    icon: (
      <svg
        viewBox="0 0 56 56"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14 42 L14 14 L38 14" filter="url(#sketchy)" />
        <path d="M18 22 Q24 20 30 22 T42 22" filter="url(#sketchy)" />
        <path d="M18 30 Q22 28 26 30" filter="url(#sketchy)" />
        <path d="M18 38 Q26 36 34 38 T40 38" filter="url(#sketchy)" />
        <circle cx={40} cy={10} r={4} fill="#f0d87a" stroke="none" />
      </svg>
    ),
  },
  {
    title: "เช็คลิสต์ & Todo",
    desc: "สร้างรายการสิ่งที่ต้องทำ ติ๊กเสร็จทีละข้อ ดูสถานะงานที่เหลือได้ในปุ่มเดียว ไม่มีหลุด",
    icon: (
      <svg
        viewBox="0 0 56 56"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x={10} y={10} width={36} height={36} rx={2} filter="url(#sketchy)" />
        <path d="M18 28 L24 34 L38 20" strokeWidth={3} filter="url(#sketchy)" />
      </svg>
    ),
  },
  {
    title: "จัดระเบียบด้วยโฟลเดอร์",
    desc: "แยกโน้ตตามวิชา ตามโปรเจค ตามอะไรก็ได้ ลากวางง่าย ค้นหาเร็ว หาเจอทุกอัน",
    icon: (
      <svg
        viewBox="0 0 56 56"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path
          d="M8 44 L8 14 C8 12 10 10 12 10 L22 10 L26 16 L44 16 C46 16 48 18 48 20 L48 44 C48 46 46 48 44 48 L12 48 C10 48 8 46 8 44Z"
          filter="url(#sketchy)"
        />
        <circle cx={28} cy={34} r={3} fill="#6aab8e" stroke="none" />
      </svg>
    ),
  },
];

export function Features() {
  return (
    <section className="features wrap" id="features">
      <div className="features-header">
        <div className="section-label">~ จุดเด่น ~</div>
        <h2 className="section-title">
          ทุกอย่างที่ต้องการ
          <br />
          ไม่มีอะไรเกินจำเป็น
        </h2>
        <p className="section-desc">
          ออกแบบมาให้เรียบง่ายสำหรับนักเรียน — จดโน้ต ทำเช็คลิสต์ จัดระเบียบ โดยไม่ต้องเรียนรู้อะไรซับซ้อน
        </p>
      </div>
      <div className="features-grid">
        {features.map((f) => (
          <div key={f.title} className="feature-card">
            <div className="feature-doodle">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
