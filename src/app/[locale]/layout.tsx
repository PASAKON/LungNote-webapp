import type { Metadata, Viewport } from "next";
import { Sarabun, Caveat, JetBrains_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { isLocale, locales } from "@/i18n/config";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const sarabun = Sarabun({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const META_BY_LOCALE = {
  th: {
    title: "LungNote — จดโน้ต เช็คลิสต์ จัดระเบียบชีวิต",
    description:
      "LungNote — แอปจดโน้ต เช็คลิสต์ และไอเดีย ออกแบบสำหรับนักเรียนไทย เปิดมาก็จดได้เลย ไม่ต้องเรียนรู้อะไรซับซ้อน",
    ogLocale: "th_TH",
    ogAlt: ["en_US"],
  },
  en: {
    title: "LungNote — Notes, checklists, organized life",
    description:
      "LungNote — a simple note-taking app for Thai students. Notes, checklists, and ideas — all in one place.",
    ogLocale: "en_US",
    ogAlt: ["th_TH"],
  },
} as const;

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const meta = isLocale(locale) ? META_BY_LOCALE[locale] : META_BY_LOCALE.th;

  return {
    metadataBase: new URL("https://lungnote.com"),
    title: { default: meta.title, template: "%s · LungNote" },
    description: meta.description,
    applicationName: "LungNote",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "LungNote",
    },
    formatDetection: { telephone: false },
    alternates: {
      canonical: `/${locale}`,
      languages: {
        th: "/th",
        en: "/en",
      },
    },
    openGraph: {
      type: "website",
      siteName: "LungNote",
      title: meta.title,
      description: meta.description,
      url: `/${locale}`,
      locale: meta.ogLocale,
      alternateLocale: [...meta.ogAlt],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1e1c" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html
      lang={locale}
      className={`${sarabun.variable} ${caveat.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
