import * as React from 'react';

/**
 * A single expand/collapse FAQ row, shared by the landing page and the redesigned Security &
 * Anti-Scam page (extracted from LandingPage.tsx, 2026-09-10, to avoid a second identical copy).
 * Pairs with the `.faq-item`/`.faq-summary`/`.faq-plus` CSS in landingMockupClone.css - only
 * meaningful inside a `.landing-mockup` scope.
 */
export function FaqAccordionItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className={`faq-item ${open ? 'open' : ''}`}>
      <button type="button" className="faq-summary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {question}
        <span className="faq-plus" aria-hidden="true">+</span>
      </button>
      {open && <p>{answer}</p>}
    </div>
  );
}
