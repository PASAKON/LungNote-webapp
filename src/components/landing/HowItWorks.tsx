import type { LandingContent } from "./content";

export function HowItWorks({ content }: { content: LandingContent["how"] }) {
  return (
    <section className="how-it-works wrap" id="how">
      <div className="how-header">
        <div className="section-label">{content.label}</div>
        <h2 className="section-title">{content.title}</h2>
        <p className="section-desc">{content.desc}</p>
      </div>
      <div className="steps">
        {content.steps.map((s, i) => (
          <div key={s.title} className="step">
            <div className="step-circle">
              <span>{i + 1}</span>
            </div>
            <h3>{s.title}</h3>
            <p>{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
