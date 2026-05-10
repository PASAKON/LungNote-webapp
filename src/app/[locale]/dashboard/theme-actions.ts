"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { THEME_COOKIE, isTheme } from "@/lib/theme";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Set the theme cookie + revalidate so the next render applies the
 * `data-theme` attribute server-side (no flash).
 */
export async function setTheme(value: string): Promise<void> {
  if (!isTheme(value)) return;
  const c = await cookies();
  c.set(THEME_COOKIE, value, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: false, // readable by client toggle if we ever need optimistic UI
  });
  revalidatePath("/", "layout");
}
