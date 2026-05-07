export function Hero() {
  return (
    <section className="hero wrap" id="hero">
      <svg
        className="doodle-star"
        width={48}
        height={48}
        viewBox="0 0 48 48"
        fill="none"
        stroke="#2c2a25"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          d="M24 4 L28 18 L42 18 L30 26 L34 40 L24 31 L14 40 L18 26 L6 18 L20 18 Z"
          strokeLinejoin="round"
          filter="url(#sketchy)"
        />
      </svg>
      <svg
        className="doodle-circle"
        width={40}
        height={40}
        viewBox="0 0 40 40"
        fill="none"
        stroke="#6aab8e"
        strokeWidth={2}
        aria-hidden="true"
      >
        <circle cx={20} cy={20} r={16} filter="url(#sketchy)" />
      </svg>
      <svg
        className="doodle-arrow"
        width={60}
        height={40}
        viewBox="0 0 60 40"
        fill="none"
        stroke="#2c2a25"
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M4 30 Q20 8 52 12" filter="url(#sketchy)" />
        <path d="M44 6 L52 12 L44 18" filter="url(#sketchy)" />
      </svg>

      <div className="hero-eyebrow">Note-taking for students</div>
      <h1>
        จดทุกอย่าง
        <br />
        ด้วย<span className="highlight-tape">ลายมือ</span>ของคุณ
      </h1>
      <p className="subtitle">
        โน้ต เช็คลิสต์ และไอเดีย — ทุกอย่างอยู่ในที่เดียว
        <br />
        เรียบง่ายเหมือนเปิดสมุดโน้ตเล่มใหม่
      </p>
      <a href="#download" className="btn-sketchy">
        เริ่มจดฟรี →
      </a>

      <div className="notebook-preview">
        <div className="spiral-holes">
          {[28, 76, 124, 172, 220, 268].map((top) => (
            <div key={top} className="spiral-hole" style={{ top }} />
          ))}
        </div>
        <div className="notebook-header">บันทึกของฉัน — วันนี้</div>
        <div className="notebook-body">
          <div className="todo-item">
            <span className="todo-box done" />
            <span className="todo-done-text">อ่านบท 5 วิชาฟิสิกส์</span>
          </div>
          <div className="todo-item">
            <span className="todo-box done" />
            <span className="todo-done-text">ส่งรายงานกลุ่ม</span>
          </div>
          <div className="todo-item">
            <span className="todo-box" />
            <span>ทบทวนศัพท์ภาษาอังกฤษ 20 คำ</span>
          </div>
          <div className="todo-item">
            <span className="todo-box" />
            <span>เตรียมพรีเซนต์วันพุธ</span>
          </div>
          <div className="note-line" style={{ marginTop: 8 }}>
            อย่าลืมถามอาจารย์เรื่องเกรด...
          </div>
        </div>
      </div>
    </section>
  );
}
