import type { LandingContent } from "./content";

export function Testimonials({
  content,
}: {
  content: LandingContent["testimonials"];
}) {
  return (
    <section className="testimonials wrap" id="reviews">
      <div className="testimonials-header">
        <div className="section-label">{content.label}</div>
        <h2 className="section-title">{content.title}</h2>
        <p className="section-desc">{content.desc}</p>
      </div>
      <div className="testimonials-grid">
        {content.items.map((t) => (
          <div key={t.name} className="testimonial-card">
            <span className="testimonial-quote">&ldquo;</span>
            <p className="testimonial-text">{t.text}</p>
            <div className="testimonial-author">
              <div className="author-avatar">{t.initial}</div>
              <div className="author-info">
                <span className="author-name">{t.name}</span>
                <span className="author-role">{t.role}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
