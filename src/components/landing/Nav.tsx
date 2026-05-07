import { LogoMark } from "./LogoMark";

export function Nav() {
  return (
    <header className="wrap">
      <nav className="top-nav">
        <a href="#" className="logo">
          <LogoMark className="logo-icon" size={36} />
          <span className="logo-text">
            Lung<span>Note</span>
          </span>
        </a>
        <ul>
          <li>
            <a href="#features">จุดเด่น</a>
          </li>
          <li>
            <a href="#how">วิธีใช้</a>
          </li>
          <li>
            <a href="#reviews">รีวิว</a>
          </li>
          <li>
            <a href="#faq">คำถาม</a>
          </li>
          <li>
            <a href="#download" className="btn-sketchy btn-nav">
              ดาวน์โหลด
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
