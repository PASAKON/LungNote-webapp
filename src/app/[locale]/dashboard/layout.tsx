import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
  params,
}: LayoutProps<"/[locale]/dashboard">) {
  const { locale } = await params;

  // Debug: log sb-* cookies received by the dashboard request before
  // we hand them to the SSR client. Pairs with the
  // session_cookies_present crumb from /api/auth/liff so we can see if
  // fresh cookies actually arrived here.
  const cookieStore = await cookies();
  const sbCookies = cookieStore
    .getAll()
    .filter((c) => c.name.startsWith("sb-"))
    .map((c) => ({ name: c.name, len: (c.value ?? "").length }));
  console.log(
    JSON.stringify({
      tag: "dashboard_layout",
      // eslint-disable-next-line react-hooks/purity
      ts: Date.now(),
      step: "cookies_received",
      cookies: sbCookies,
    }),
  );

  const supabase = await createClient();
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    console.log(
      JSON.stringify({
        tag: "dashboard_layout",
        // eslint-disable-next-line react-hooks/purity
        ts: Date.now(),
        step: "get_user_ok",
        hasUser: !!user,
      }),
    );
  } catch (err) {
    console.log(
      JSON.stringify({
        tag: "dashboard_layout",
        // eslint-disable-next-line react-hooks/purity
        ts: Date.now(),
        step: "get_user_error",
        msg: err instanceof Error ? err.message : String(err),
      }),
    );
    // Treat as unauthenticated — page-level redirect to landing handles
    // the re-auth flow.
  }

  if (!user) {
    redirect(`/${locale}`);
  }

  return <>{children}</>;
}
