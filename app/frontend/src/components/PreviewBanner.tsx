import { AlertTriangle, Zap } from 'lucide-react';

/**
 * Always-visible reminder that this build mixes real, live backend data
 * (most pages, as of 2026-07-11 — see `App.tsx`'s routing comment for the
 * current per-page wiring status) with a few screens/sections that are
 * still hand-authored mock data paired with REAL customer names (see
 * `src/lib/mockData.ts` header comment) — must stay visible on every
 * screen, not just buried in a footer, so nobody mistakes the still-mock
 * portions for production data, or a screenshot of either for something
 * safe to share externally.
 *
 * 2026-07-11 audit: Dashboard's loan list/Recent Activity (real: GET /loan-accounts, GET
 * /audit-logs) and Loan Detail's Notes (real, this session's own feature) were stale claims here —
 * corrected. Attachments/AI Risk/Timeline never actually appear on a real (migrated) loan at all —
 * they only exist on a separate, effectively unreachable hand-authored mock-loan view — dropped
 * from this list rather than left as a misleading "still sample data" claim. Settings' own
 * activity log remains genuinely mock (`MOCK_ACTIVITY_LOGS`) — the one real gap left.
 */
export function PreviewBanner() {
  return (
    <div className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-xs font-medium text-warning">
      <AlertTriangle className="h-3.5 w-3.5" />
      Mixed data — most pages are live. Settings' own activity log still shows sample data. Real customer names appear
      throughout — do not share outside internal review.
      {/* import.meta.env.DEV is only true when served by `vite dev` (the local hot-reload server,
          e.g. via "Run LMS Preview.bat") — false in the Docker/nginx-served production build. Lets
          the user tell at a glance which frontend they're actually browsing when both can run
          side by side on different ports. */}
      {import.meta.env.DEV && (
        <span className="ml-2 flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-warning">
          <Zap className="h-3 w-3" />
          Hot Reload — localhost:{window.location.port || '80'}
        </span>
      )}
    </div>
  );
}

export function PreviewFooterNote() {
  return (
    <p className="px-1 py-4 text-center text-xs text-muted-foreground">
      Easycash Lending Company Inc. — UI Preview Build (Milestone 9.1). Loan/balance/payment/notes data and Dashboard activity
      are live. Settings' own activity log still shows sample data. Borrower names are real throughout — not for external
      distribution.
    </p>
  );
}
