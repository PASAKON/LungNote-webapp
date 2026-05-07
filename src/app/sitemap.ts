import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return locales.map((locale) => ({
    url: `https://lungnote.com/${locale}`,
    lastModified,
    changeFrequency: "weekly",
    priority: locale === "th" ? 1 : 0.8,
    alternates: {
      languages: Object.fromEntries(
        locales.map((l) => [l, `https://lungnote.com/${l}`]),
      ),
    },
  }));
}
