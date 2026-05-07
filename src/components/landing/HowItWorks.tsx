const steps = [
  {
    n: 1,
    title: "สร้างสมุดโน้ต",
    desc: "ตั้งชื่อสมุดเล่มแรกของคุณ เลือกสีปก ตั้งหมวดหมู่ ใช้เวลาไม่ถึง 10 วินาที",
  },
  {
    n: 2,
    title: "จดทุกอย่าง",
    desc: "เขียนโน้ต สร้าง Todo List จดไอเดียที่ผุดขึ้นมา ทุกอย่างบันทึกอัตโนมัติ",
  },
  {
    n: 3,
    title: "จัดระเบียบ & ค้นหา",
    desc: "แท็ก ค้นหา กรองตามวัน — กลับมาหาโน้ตเก่าได้เสมอ ไม่มีหายไปไหน",
  },
];

export function HowItWorks() {
  return (
    <section className="how-it-works wrap" id="how">
      <div className="how-header">
        <div className="section-label">~ วิธีใช้ ~</div>
        <h2 className="section-title">เริ่มจดได้ใน 3 ขั้นตอน</h2>
        <p className="section-desc">
          ไม่ต้องสมัครสมาชิกยุ่งยาก ไม่ต้องตั้งค่าอะไรเยอะ เปิดมาก็จดได้เลย
        </p>
      </div>
      <div className="steps">
        {steps.map((s) => (
          <div key={s.n} className="step">
            <div className="step-circle">
              <span>{s.n}</span>
            </div>
            <h3>{s.title}</h3>
            <p>{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
