import * as React from 'react';

/**
 * Scroll-triggered fade/slide-in wrapper, shared by the landing page and the redesigned public
 * content pages (Requirements, Security & Anti-Scam) - extracted from LandingPage.tsx (2026-09-10)
 * so all three don't each keep their own copy. Pairs with the `.reveal`/`.reveal.in` CSS in
 * landingMockupClone.css - only meaningful inside a `.landing-mockup` scope.
 */
export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const [inView, setInView] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      // Generous margin: a fast scroll/fling can jump far enough in one frame that an element's
      // intersecting window is never actually rendered, so the callback never fires and content
      // stays permanently invisible. A wide margin makes that window much larger relative to any
      // single scroll delta.
      { threshold: 0, rootMargin: '400px 0px -10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${inView ? 'in' : ''} ${className ?? ''}`}>
      {children}
    </div>
  );
}
