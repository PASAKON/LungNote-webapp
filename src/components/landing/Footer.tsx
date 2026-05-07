import { LogoMark } from "./LogoMark";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer>
      <div className="wrap">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 8,
            color: "var(--fg)",
          }}
        >
          <LogoMark size={24} />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 28,
              fontWeight: 700,
              color: "var(--fg)",
            }}
          >
            Lung
            <span style={{ color: "var(--accent)" }}>Note</span>
          </span>
        </div>
        <p>สร้างด้วยความตั้งใจ สำหรับนักเรียนที่ชอบจดโน้ต</p>
        <p style={{ marginTop: 8 }}>
          © {year} LungNote · <a href="#">ข้อกำหนด</a> ·{" "}
          <a href="#">ความเป็นส่วนตัว</a> · <a href="#">ติดต่อเรา</a>
        </p>
      </div>
    </footer>
  );
}
