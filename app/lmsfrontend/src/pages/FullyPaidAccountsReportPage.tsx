import * as React from 'react';
import { AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangeFilter, type DateRange } from '@/components/DateRangeFilter';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { downloadFile, ApiError } from '@/lib/apiClient';
import { isoDate } from '@/lib/utils';

/**
 * Real `.xlsx` download (`GET /reports/fully-paid.xlsx`) - a like-for-like replacement of the
 * legacy "Operation - Fully Paid Accounts" report.
 *
 * 2026-08-04 correction (user-verified against SDevTech): previously "as-of-today, no date
 * filter", which listed all 517 CLOSED loans ever - SDevTech's own report is date-scoped too
 * (only 8 rows in a same-day comparison). Filters on Fully Paid Date, same convention as every
 * other date-ranged report here.
 */
export function FullyPaidAccountsReportPage() {
  useLogPageView('Fully Paid Accounts Report');
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
      await downloadFile(`/reports/fully-paid.xlsx${query ? `?${query}` : ''}`, 'Fully Paid Accounts.xlsx');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Check your connection and try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Fully Paid Accounts</h2>
        <p className="text-sm text-muted-foreground">Every loan settled in full (CLOSED) whose Fully Paid Date falls in the selected range.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Date range filters on Fully Paid Date. Defaults to the current month.</CardDescription>
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

      <RecentActivityPanel label="Fully Paid Accounts Report" />
    </div>
  );
}
