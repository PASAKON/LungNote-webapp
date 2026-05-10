"use client";
import { useTransition, useState, type ComponentType } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { setTheme } from "./theme-actions";
import type { Theme } from "@/lib/theme";

type IconProps = { size?: number; strokeWidth?: number };

const OPTIONS: Array<{
  value: Theme;
  label: string;
  Icon: ComponentType<IconProps>;
}> = [
  { value: "light", label: "สว่าง", Icon: Sun },
  { value: "dark", label: "มืด", Icon: Moon },
  { value: "system", label: "ตามระบบ", Icon: Monitor },
];

/**
 * Theme picker — 3 segmented options. Cookie + revalidate path on
 * change, so SSR `data-theme` attribute matches before next paint.
 * No flash, no localStorage divergence.
 */
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [current, setCurrent] = useState<Theme>(initial);
  const [pending, startTransition] = useTransition();

  function pick(v: Theme) {
    if (v === current) return;
    setCurrent(v); // optimistic UI
    // Optimistically flip the html attribute so the page tints
    // immediately before the server action settles.
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      if (v === "system") root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", v);
    }
    startTransition(async () => {
      try {
        await setTheme(v);
      } catch {
        // Revert if the server rejects.
        setCurrent(initial);
        if (typeof document !== "undefined") {
          const root = document.documentElement;
          if (initial === "system") root.removeAttribute("data-theme");
          else root.setAttribute("data-theme", initial);
        }
      }
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label="ธีม"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 8,
        padding: 4,
        background: "var(--accent-light)",
        borderRadius: 10,
        opacity: pending ? 0.7 : 1,
        transition: "opacity 0.15s",
      }}
    >
      {OPTIONS.map((opt) => {
        const active = current === opt.value;
        const Icon = opt.Icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => pick(opt.value)}
            disabled={pending}
            style={{
              padding: "10px 8px",
              borderRadius: 8,
              border: active ? "2px solid var(--accent)" : "2px solid transparent",
              background: active ? "var(--surface)" : "transparent",
              color: active ? "var(--accent)" : "var(--muted)",
              fontFamily: "var(--font-body)",
              fontSize: 14,
              fontWeight: active ? 600 : 400,
              cursor: pending ? "wait" : "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              transition: "background 0.15s, color 0.15s",
            }}
          >
            <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
            <span style={{ color: "var(--fg)" }}>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
