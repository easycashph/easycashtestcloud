import * as React from 'react';
import { AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangeFilter, type DateRange } from '@/components/DateRangeFilter';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { downloadFile, ApiError } from '@/lib/apiClient';

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Real `.xlsx` download (`GET /reports/accounts-past-due.xlsx`) - a like-for-like replacement of
 * the legacy "Collection - Accounts with Past Due" report, filtered on the oldest-unpaid
 * installment's due date.
 *
 * 2026-08-03 correction (user-verified directly against the live SDevTech UI): this was
 * previously "as-of-today, no date filter", copied from an old static legacy sample file that
 * had no date-range columns - wrong for this report specifically. Without a filter, every unpaid
 * installment ever migrated stayed in scope forever (some as far back as 2012).
 */
export function AccountsWithPastDueReportPage() {
  useLogPageView('Accounts with Past Due Report');
  const [range, setRange] = React.useState<DateRange>(() => {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    return { from: isoDate(from), to: isoDate(to) };
  });
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);
      const query = params.toString();
      await downloadFile(`/reports/accounts-past-due.xlsx${query ? `?${query}` : ''}`, 'Accounts with Past Due.xlsx');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Check your connection and try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Accounts with Past Due</h2>
        <p className="text-sm text-muted-foreground">Overdue accounts whose oldest unpaid due date falls in the selected range.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Date range filters on the oldest unpaid installment's due date. Defaults to the current month.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <DateRangeFilter value={range} onChange={setRange} />
            <Button onClick={handleDownload} disabled={isDownloading}>
              <Download className="mr-2 h-4 w-4" />
              {isDownloading ? 'Preparing…' : 'Download report'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <RecentActivityPanel label="Accounts with Past Due Report" />
    </div>
  );
}
