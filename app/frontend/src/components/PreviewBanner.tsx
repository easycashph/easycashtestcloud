import { AlertTriangle, Zap } from 'lucide-react';

/**
 * Always-visible reminder that this build is a CEO-facing UI preview using
 * mock data paired with REAL customer names (see `src/lib/mockData.ts`
 * header comment) — must stay visible on every screen, not just buried in
 * a footer, so nobody mistakes a screenshot of this build for production.
 */
export function PreviewBanner() {
  return (
    <div className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-xs font-medium text-warning">
      <AlertTriangle className="h-3.5 w-3.5" />
      Preview Mode — Sample Data. Not connected to live systems. Contains real customer names with fabricated figures — do not share
      outside internal review.
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
      Easycash Lending Company Inc. — UI Preview Build (Milestone 9.1). All loan/balance/schedule figures shown are sample data for
      layout demonstration only. Borrower names are real; financial figures are not. Not for external distribution.
    </p>
  );
}
