import { AlertTriangle } from 'lucide-react';

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
