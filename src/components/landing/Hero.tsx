import type { LandingContent } from "./content";

export function Hero({ content }: { content: LandingContent["hero"] }) {
  return (
    <section className="hero wrap" id="hero">
      <svg
        className="doodle-star"
        width={48}
        height={48}
        viewBox="0 0 48 48"
        fill="none"
        stroke="#2c2a25"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          d="M24 4 L28 18 L42 18 L30 26 L34 40 L24 31 L14 40 L18 26 L6 18 L20 18 Z"
          strokeLinejoin="round"
          filter="url(#sketchy)"
        />
      </svg>
      <svg
        className="doodle-circle"
        width={40}
        height={40}
        viewBox="0 0 40 40"
        fill="none"
        stroke="#6aab8e"
        strokeWidth={2}
        aria-hidden="true"
      >
        <circle cx={20} cy={20} r={16} filter="url(#sketchy)" />
      </svg>
      <svg
        className="doodle-arrow"
        width={60}
        height={40}
        viewBox="0 0 60 40"
        fill="none"
        stroke="#2c2a25"
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M4 30 Q20 8 52 12" filter="url(#sketchy)" />
        <path d="M44 6 L52 12 L44 18" filter="url(#sketchy)" />
      </svg>

      <div className="hero-eyebrow">{content.eyebrow}</div>
      <h1>
        {content.titleLine1}
        <br />
        {content.titleBefore}
        <span className="highlight-tape">{content.titleHighlight}</span>
        {content.titleAfter}
      </h1>
      <p className="subtitle">{content.subtitle}</p>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/api/auth/line/oauth/start" className="btn-sketchy">
        {content.cta}
      </a>

      <div className="notebook-preview">
        <div className="spiral-holes">
          {[28, 76, 124, 172, 220, 268].map((top) => (
            <div key={top} className="spiral-hole" style={{ top }} />
          ))}
        </div>
        <div className="notebook-header">{content.notebookHeader}</div>
        <div className="notebook-body">
          {content.todos.map((todo) => (
            <div key={todo.text} className="todo-item">
              <span className={`todo-box${todo.done ? " done" : ""}`} />
              <span className={todo.done ? "todo-done-text" : undefined}>
                {todo.text}
              </span>
            </div>
          ))}
          <div className="note-line" style={{ marginTop: 8 }}>
            {content.noteLine}
          </div>
        </div>
      </div>
    </section>
  );
}
