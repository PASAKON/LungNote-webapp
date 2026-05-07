type Testimonial = {
  text: string;
  initial: string;
  name: string;
  role: string;
};

const testimonials: Testimonial[] = [
  {
    text: "ใช้มาหลายแอปแล้ว LungNote เป็นตัวเดียวที่เปิดมาก็จดได้เลย ไม่ต้องนั่งตั้งค่า ไม่ต้องเรียนรู้ระบบอะไรยุ่งยาก ฟอนต์ลายมือสวยมากด้วย",
    initial: "พ",
    name: "พลอย",
    role: "นักศึกษาปี 2 คณะอักษรศาสตร์ จุฬาฯ",
  },
  {
    text: "ชอบที่มันเรียบง่ายจริงๆ ไม่มีฟีเจอร์เยอะจนสับสน Todo List ช่วยจัดระเบียบการบ้านได้ดีมาก ติ๊กเสร็จทีละข้อรู้สึกดี",
    initial: "ก",
    name: "กันต์",
    role: "นักเรียน ม.5 โรงเรียนเตรียมอุดมฯ",
  },
  {
    text: "Sync ข้ามอุปกรณ์ดีมาก จดบนมือถือตอนนั่งรถ กลับบ้านเปิดคอมก็เจอโน้ตเหมือนเดิม ไม่เคยมีโน้ตหายเลยแม้แต่ครั้งเดียว",
    initial: "ม",
    name: "มิ้นท์",
    role: "นักศึกษาปี 3 คณะวิศวกรรมฯ มจธ.",
  },
];

export function Testimonials() {
  return (
    <section className="testimonials wrap" id="reviews">
      <div className="testimonials-header">
        <div className="section-label">~ รีวิวจากผู้ใช้ ~</div>
        <h2 className="section-title">เพื่อนๆ นักเรียนพูดถึงเรา</h2>
        <p className="section-desc">
          ลองฟังจากคนที่ใช้จริง — นักเรียน นักศึกษา และคนทำงานที่จดโน้ตทุกวัน
        </p>
      </div>
      <div className="testimonials-grid">
        {testimonials.map((t) => (
          <div key={t.name} className="testimonial-card">
            <span className="testimonial-quote">&ldquo;</span>
            <p className="testimonial-text">{t.text}</p>
            <div className="testimonial-author">
              <div className="author-avatar">{t.initial}</div>
              <div className="author-info">
                <span className="author-name">{t.name}</span>
                <span className="author-role">{t.role}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
