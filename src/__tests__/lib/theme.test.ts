import { describe, it, expect, vi } from "vitest";
import { isTheme } from "@/lib/theme";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

describe("theme helpers", () => {
  it("isTheme accepts 3 values + rejects others", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("system")).toBe(true);
    expect(isTheme("auto")).toBe(false);
    expect(isTheme("")).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(undefined)).toBe(false);
    expect(isTheme(123)).toBe(false);
  });

  it("getThemeFromCookies defaults to system when cookie missing", async () => {
    const { getThemeFromCookies } = await import("@/lib/theme");
    expect(await getThemeFromCookies()).toBe("system");
  });
});
