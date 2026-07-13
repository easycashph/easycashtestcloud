import { AlertTriangle, Zap } from 'lucide-react';

/**
 * Always-visible reminder that this build mixes real, live backend data with the few remaining
 * disclosed sample-data exceptions - must stay visible on every screen, not just buried in a
 * footer, so nobody mistakes a screenshot of this build for a fully production-ready system.
 *
 * 2026-07-13 (post-merge correction): superseded both this file's own prior claims (2026-07-11:
 * "Settings' own activity log remains genuinely mock") and a second, independently-written version
 * that still listed "Reports, Payment Reminders, Settings, and About" as mock-only - stale relative
 * to `App.tsx`'s own routing doc comment (2026-07-12 mock-removal pass), which is the current
 * source of truth: every route is real except the Collections vs. Target chart's target line
 * (disclosed sample data pending a business decision on how a real monthly target gets set).
 */
export function PreviewBanner() {
  return (
    <div className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-xs font-medium text-warning">
      <AlertTriangle className="h-3.5 w-3.5" />
      Live data — the Collections vs. Target chart's monthly target line is the one remaining sample-data exception. Real
      customer names appear throughout — do not share outside internal review.
      {/* import.meta.env.DEV is only true when served by `vite dev` (the local hot-reload server,
          e.g. via "Run LMS Preview.bat") - false in the Docker/nginx-served production build. Lets
          the user tell at a glance which frontend they're actually browsing when both can run
          side by side on different ports. */}
      {import.meta.env.DEV && (
        <span className="ml-2 flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-warning">
          <Zap className="h-3 w-3" />
          Hot Reload - localhost:{window.location.port || '80'}
        </span>
      )}
    </div>
  );
}

export function PreviewFooterNote() {
  return (
    <p className="px-1 py-4 text-center text-xs text-muted-foreground">
      Easycash Lending Company Inc. — UI Preview Build. Loan, borrower, payment, and portfolio figures shown are real, live
      data from the production database migration. Borrower names are real throughout — not for external distribution.
    </p>
  );
}
