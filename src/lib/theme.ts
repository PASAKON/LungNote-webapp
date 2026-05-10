import "server-only";
import { cookies } from "next/headers";

/**
 * Theme preference — cookie-driven so SSR can apply `data-theme` on
 * <html> before first paint (no light/dark flash).
 *
 *   - "light"  → force light, ignore OS preference
 *   - "dark"   → force dark, ignore OS preference
 *   - "system" → respect prefers-color-scheme media query (default)
 */
export type Theme = "light" | "dark" | "system";

export const THEME_COOKIE = "lungnote_theme";
export const DEFAULT_THEME: Theme = "system";

export function isTheme(v: unknown): v is Theme {
  return v === "light" || v === "dark" || v === "system";
}

/** Read theme from request cookies. Falls back to "system". */
export async function getThemeFromCookies(): Promise<Theme> {
  const c = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(c) ? c : DEFAULT_THEME;
}
