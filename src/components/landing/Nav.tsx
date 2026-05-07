import { LogoMark } from "./LogoMark";
import type { LandingContent } from "./content";

export function Nav({ content }: { content: LandingContent["nav"] }) {
  return (
    <header className="wrap">
      <nav className="top-nav">
        <a href="#" className="logo">
          <LogoMark className="logo-icon" size={36} />
          <span className="logo-text">
            Lung<span>Note</span>
          </span>
        </a>
        <ul>
          <li>
            <a href="#features">{content.features}</a>
          </li>
          <li>
            <a href="#how">{content.how}</a>
          </li>
          <li>
            <a href="#reviews">{content.reviews}</a>
          </li>
          <li>
            <a href="#faq">{content.faq}</a>
          </li>
          <li>
            <a href="#download" className="btn-sketchy btn-nav">
              {content.download}
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
