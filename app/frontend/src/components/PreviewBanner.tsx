import { AlertTriangle, Zap } from 'lucide-react';

/**
 * Always-visible reminder that this build is still an internal preview release, even though (as
 * of the 2026-07-12 mock-removal pass, see `docs/SESSION_LOG_2026-07-12.md`) every page now reads
 * exclusively from the real backend/database - `src/lib/mockData.ts` no longer exists. The two
 * genuinely-remaining placeholders are named explicitly rather than lumped into a vague "some
 * things are still mock" claim: Dashboard's Collections vs. Target chart (blocked on a business
 * decision - no real monthly target exists to compute against yet) and SMS/Email sending on
 * Payment Reminders (blocked on a messaging provider, pending MIS). Must stay visible on every
 * screen, not just buried in a footer, so nobody mistakes a screenshot of this build for a
 * publicly-released product before it's gone through a full release process.
 */
export function PreviewBanner() {
  return (
    <div className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-xs font-medium text-warning">
      <AlertTriangle className="h-3.5 w-3.5" />
      Preview Mode - every page uses real, live data, except the Dashboard's Collections vs. Target chart (placeholder, pending a
      target-setting decision) and SMS/Email sending on Payment Reminders (pending a messaging provider). Do not share outside internal
      review.
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
      Easycash Lending Company Inc. - Internal Preview Build. Every page reads real, live data from the production database, except the
      Dashboard's Collections vs. Target chart and SMS/Email sending on Payment Reminders, both pending a business/infrastructure
      decision. Not for external distribution.
    </p>
  );
}
