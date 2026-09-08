/** 2026-09-08 (user request): temporary placeholder swapped in for `<App />` in `main.tsx` while
 * the Portal is taken offline for rework - a plain page instead of a broken/error-prone UI hitting
 * a dead backend tunnel. Revert by swapping `<App />` back in `main.tsx` when the Portal returns. */
export default function UnderDevelopment() {
  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        color: '#1a1a1a',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        fontSize: '1.25rem',
        textAlign: 'center',
        padding: '1rem',
      }}
    >
      Under Development, check back soon.
    </div>
  );
}
