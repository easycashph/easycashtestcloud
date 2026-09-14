import * as React from 'react';

/**
 * Counts up from 0 to a real, already-published number when it scrolls into view (2026-09-10,
 * "animated counters where appropriate" - homepage stats band). Never invents a number itself -
 * `to` must come from the same real values already shown elsewhere (see LandingPage.tsx's
 * `t.landing.stat*Label` stats). Respects `prefers-reduced-motion`: renders the final value
 * immediately with no animation rather than just a faster one.
 */
export function AnimatedCounter({ to, suffix = '', durationMs = 1400 }: { to: number; suffix?: string; durationMs?: number }) {
  const [value, setValue] = React.useState(0);
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setValue(to);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        io.disconnect();

        const start = performance.now();
        const step = (now: number) => {
          const progress = Math.min((now - start) / durationMs, 1);
          // Ease-out cubic - starts fast, settles gently rather than a linear tick-up.
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(Math.round(to * eased));
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      { threshold: 0, rootMargin: '400px 0px -10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, durationMs]);

  return (
    <span ref={ref}>
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}
