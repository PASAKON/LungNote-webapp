import type { LandingContent } from "./content";

const icons = [
  (
    <svg
      key="notes"
      viewBox="0 0 56 56"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 42 L14 14 L38 14" filter="url(#sketchy)" />
      <path d="M18 22 Q24 20 30 22 T42 22" filter="url(#sketchy)" />
      <path d="M18 30 Q22 28 26 30" filter="url(#sketchy)" />
      <path d="M18 38 Q26 36 34 38 T40 38" filter="url(#sketchy)" />
      <circle cx={40} cy={10} r={4} fill="#d4a855" stroke="none" />
    </svg>
  ),
  (
    <svg
      key="check"
      viewBox="0 0 56 56"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x={10} y={10} width={36} height={36} rx={2} filter="url(#sketchy)" />
      <path d="M18 28 L24 34 L38 20" strokeWidth={3} filter="url(#sketchy)" />
    </svg>
  ),
  (
    <svg
      key="folder"
      viewBox="0 0 56 56"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d="M8 44 L8 14 C8 12 10 10 12 10 L22 10 L26 16 L44 16 C46 16 48 18 48 20 L48 44 C48 46 46 48 44 48 L12 48 C10 48 8 46 8 44Z"
        filter="url(#sketchy)"
      />
      <circle cx={28} cy={34} r={3} fill="#c9a040" stroke="none" />
    </svg>
  ),
];

export function Features({ content }: { content: LandingContent["features"] }) {
  return (
    <section className="features wrap" id="features">
      <div className="features-header">
        <div className="section-label">{content.label}</div>
        <h2 className="section-title">
          {content.titleLine1}
          <br />
          {content.titleLine2}
        </h2>
        <p className="section-desc">{content.desc}</p>
      </div>
      <div className="features-grid">
        {content.cards.map((card, i) => (
          <div key={card.title} className="feature-card">
            <div className="feature-doodle">{icons[i]}</div>
            <h3>{card.title}</h3>
            <p>{card.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
