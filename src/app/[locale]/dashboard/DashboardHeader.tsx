import Link from "next/link";
import { signOut } from "./actions";

type Props = {
  displayName: string | null;
  pictureUrl: string | null;
  locale: string;
};

export function DashboardHeader({ displayName, pictureUrl, locale }: Props) {
  const initial = (displayName ?? "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <header className="dash-header">
      <Link href={`/${locale}`} className="dash-brand">
        Lung<span>Note</span>
      </Link>
      <div className="dash-user">
        {pictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="dash-avatar"
            src={pictureUrl}
            alt={displayName ?? "user"}
            width={36}
            height={36}
          />
        ) : (
          <div className="dash-avatar fallback">{initial}</div>
        )}
        <span className="dash-username">{displayName ?? "ผู้ใช้ LINE"}</span>
        <form action={signOut}>
          <button type="submit" className="btn-secondary" aria-label="logout">
            ออก
          </button>
        </form>
      </div>
    </header>
  );
}
