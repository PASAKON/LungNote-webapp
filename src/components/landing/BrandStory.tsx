import type { LandingContent } from "./content";
import { MascotMark } from "@/components/MascotMark";

/**
 * "Meet LungNote" section. Introduces the brand metaphor — LungNote =
 * "ลังโน้ต" = a cardboard box for your memory. Sits between Hero and
 * Features so first-time visitors get the why before the what.
 */
export function BrandStory({ content }: { content: LandingContent["brand"] }) {
  return (
    <section className="brand-story wrap" id="brand">
      <div className="brand-story-inner">
        <div className="brand-story-mascot">
          <MascotMark size={140} />
        </div>
        <div className="brand-story-text">
          <div className="section-label">{content.label}</div>
          <h2 className="brand-story-name">
            {content.name}
          </h2>
          <p className="brand-story-pron">{content.pronunciation}</p>
          <p className="brand-story-body">{content.body}</p>
        </div>
      </div>
    </section>
  );
}
