import type { LandingContent } from "./content";

export function DownloadCTA({
  content,
}: {
  content: LandingContent["download"];
}) {
  return (
    <section className="download-cta wrap" id="download">
      <div className="download-card">
        <h2>
          {content.title} <span className="highlight-tape">{content.titleHighlight}</span>
        </h2>
        <p>{content.desc}</p>
        <div className="download-buttons">
          <a href="#" className="btn-download">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" />
              <path d="M15 8.5c0-1.4-1.1-2.5-2.5-2.5S10 7.1 10 8.5c0 2.5 2 2.5 2 5" />
              <circle cx={12} cy={16} r={0.5} fill="currentColor" />
            </svg>
            {content.appStore}
          </a>
          <a href="#" className="btn-download">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            {content.playStore}
          </a>
          <a href="#" className="btn-download">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x={2} y={3} width={20} height={14} rx={2} />
              <line x1={8} y1={21} x2={16} y2={21} />
              <line x1={12} y1={17} x2={12} y2={21} />
            </svg>
            {content.web}
          </a>
        </div>
        <p className="download-note">{content.note}</p>
      </div>
    </section>
  );
}
