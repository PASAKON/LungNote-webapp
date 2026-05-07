import { LogoMark } from "./LogoMark";
import type { LandingContent } from "./content";

export function Footer({ content }: { content: LandingContent["footer"] }) {
  const year = new Date().getFullYear();
  return (
    <footer>
      <div className="wrap">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 8,
            color: "var(--fg)",
          }}
        >
          <LogoMark size={24} />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 28,
              fontWeight: 700,
              color: "var(--fg)",
            }}
          >
            Lung
            <span style={{ color: "var(--accent)" }}>Note</span>
          </span>
        </div>
        <p>{content.tagline}</p>
        <p style={{ marginTop: 8 }}>
          {content.copyright(year)} · <a href="#">{content.terms}</a> ·{" "}
          <a href="#">{content.privacy}</a> · <a href="#">{content.contact}</a>
        </p>
      </div>
    </footer>
  );
}
