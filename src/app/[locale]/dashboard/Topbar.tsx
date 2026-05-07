import Link from "next/link";

type Props = {
  pictureUrl: string | null;
  initial: string;
  locale: string;
};

export function Topbar({ pictureUrl, initial, locale }: Props) {
  return (
    <header className="topbar">
      <Link href={`/${locale}`} className="topbar-logo">
        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
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
        <span className="topbar-logo-text">
          Lung<span>Note</span>
        </span>
      </Link>
      <div className="topbar-actions">
        <button type="button" className="topbar-btn" aria-label="notifications">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>
        {pictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="topbar-avatar"
            src={pictureUrl}
            alt={initial}
            width={36}
            height={36}
          />
        ) : (
          <div className="topbar-avatar" aria-label="profile">
            {initial}
          </div>
        )}
      </div>
    </header>
  );
}
