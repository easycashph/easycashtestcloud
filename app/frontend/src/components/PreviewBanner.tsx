import { AlertTriangle, Zap } from 'lucide-react';

/**
 * Always-visible reminder that this build is a CEO-facing UI preview.
 * Core loan/borrower workflows (see `App.tsx`'s routing doc comment for the
 * current real/partial/mock breakdown) are wired to the live backend and
 * database - but Reports, Payment Reminders, Settings, and About are still
 * mock-only, and a few sub-features on otherwise-real pages (Dashboard's
 * loan list; LoanDetail's notes/attachments/timeline) remain mock too. Must
 * stay visible on every screen, not just buried in a footer, so nobody
 * mistakes a screenshot of this build for a fully production-ready system.
 */
export function PreviewBanner() {
  return (
    <div className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-xs font-medium text-warning">
      <AlertTriangle className="h-3.5 w-3.5" />
      Preview Mode - most workflows use real, live data, but Reports, Payment Reminders, Settings, and About are still sample data, and a
      few sub-features on real pages remain mock. Do not share outside internal review.
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
      Easycash Lending Company Inc. - UI Preview Build. Most loan/borrower/payment figures shown are real, live data from the production
      database migration. Reports, Payment Reminders, Settings, and About still show sample data. Not for external distribution.
    </p>
  );
}
