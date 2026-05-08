import Link from "next/link";
import { signOut } from "./actions";

type Props = {
  active: "home" | "notes" | "todo" | "notebooks" | "tags" | "settings";
  notesCount?: number;
  todoCount?: number;
};

export function Sidebar({ active, notesCount, todoCount }: Props) {
  return (
    <aside className="dash-sidebar" aria-label="primary navigation">
      <Link href="/dashboard" className="sidebar-logo">
        <svg width={32} height={32} viewBox="0 0 48 48" fill="none">
          <rect
            x={6}
            y={6}
            width={36}
            height={36}
            rx={4}
            stroke="currentColor"
            strokeWidth={3}
            fill="none"
          />
          <path
            d="M14 24 L21 31 L34 16"
            stroke="currentColor"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <span className="sidebar-logo-text">
          Lung<span>Note</span>
        </span>
      </Link>

      <span className="nav-section">หลัก</span>

      <Link
        href="/dashboard"
        className={`nav-item${active === "home" ? " active" : ""}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <rect x={3} y={3} width={7} height={7} />
          <rect x={14} y={3} width={7} height={7} />
          <rect x={3} y={14} width={7} height={7} />
          <rect x={14} y={14} width={7} height={7} />
        </svg>
        <span>หน้าหลัก</span>
      </Link>

      <Link
        href="/dashboard/notes/new"
        className={`nav-item${active === "notes" ? " active" : ""}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        <span>โน้ต</span>
        {!!notesCount && <span className="nav-badge">{notesCount}</span>}
      </Link>

      <Link
        href="/dashboard"
        className={`nav-item${active === "todo" ? " active" : ""}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
        <span>Todo</span>
        {!!todoCount && <span className="nav-badge">{todoCount}</span>}
      </Link>

      <span className="nav-section">อื่นๆ</span>

      <Link
        href="/dashboard"
        className={`nav-item${active === "notebooks" ? " active" : ""}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
        <span>สมุดโน้ต</span>
      </Link>

      <Link
        href="/dashboard"
        className={`nav-item${active === "tags" ? " active" : ""}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1={7} y1={7} x2={7.01} y2={7} />
        </svg>
        <span>แท็ก</span>
      </Link>

      <Link
        href="/dashboard"
        className={`nav-item${active === "settings" ? " active" : ""}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx={12} cy={12} r={3} />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span>ตั้งค่า</span>
      </Link>

      <div className="sidebar-footer">
        <form action={signOut}>
          <button type="submit" className="nav-item nav-item-logout">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1={21} y1={12} x2={9} y2={12} />
            </svg>
            <span>ออกจากระบบ</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
