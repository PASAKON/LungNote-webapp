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

export const metadata: Metadata = {
  metadataBase: new URL("https://lungnote.com"),
  title: {
    default: "LungNote — จดโน้ต เช็คลิสต์ จัดระเบียบชีวิต",
    template: "%s · LungNote",
  },
  description:
    "LungNote — แอปจดโน้ต เช็คลิสต์ และไอเดีย ออกแบบสำหรับนักเรียนไทย เปิดมาก็จดได้เลย ไม่ต้องเรียนรู้อะไรซับซ้อน",
  applicationName: "LungNote",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LungNote",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "LungNote",
    title: "LungNote — จดโน้ต เช็คลิสต์ จัดระเบียบชีวิต",
    description:
      "แอปจดโน้ตเรียบง่ายสำหรับนักเรียนไทย โน้ต เช็คลิสต์ ไอเดีย ทุกอย่างอยู่ในที่เดียว",
    url: "/",
    locale: "th_TH",
    alternateLocale: ["en_US"],
  },
  twitter: {
    card: "summary_large_image",
    title: "LungNote",
    description:
      "แอปจดโน้ตเรียบง่ายสำหรับนักเรียนไทย โน้ต เช็คลิสต์ ไอเดีย ทุกอย่างอยู่ในที่เดียว",
  },
};

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
