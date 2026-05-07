"use client";

import { useState } from "react";
import type { LandingContent } from "./content";

export function Faq({ content }: { content: LandingContent["faq"] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="faq wrap" id="faq">
      <div className="faq-header">
        <div className="section-label">{content.label}</div>
        <h2 className="section-title">{content.title}</h2>
      </div>
      <div className="faq-list">
        {content.items.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={item.q} className={`faq-item${isOpen ? " open" : ""}`}>
              <button
                type="button"
                className="faq-q"
                aria-expanded={isOpen}
                onClick={() => setOpenIndex(isOpen ? null : i)}
              >
                {item.q}
                <svg
                  className="arrow"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div className="faq-a">
                <p>{item.a}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
