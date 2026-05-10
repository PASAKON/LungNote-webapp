import "./admin.css";

export const metadata = {
  title: "LungNote Admin",
  robots: { index: false, follow: false },
};

/**
 * Root admin shell — wraps both /admin/login and /admin/(protected)/*.
 * No auth check here; that lives in (protected)/layout.tsx so the login
 * page can render without bouncing in a redirect loop.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
