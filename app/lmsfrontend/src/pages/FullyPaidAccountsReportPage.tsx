import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DateRangeFilter, type DateRange } from '@/components/DateRangeFilter';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { ReportLoadingProgress } from '@/components/ReportLoadingProgress';
import { useLogPageView } from '@/lib/activityLog';
import { apiClient, downloadFile, ApiError } from '@/lib/apiClient';
import type { FullyPaidAccountsReportRow } from '@/lib/reportApiTypes';
import { formatDate, formatPeso, isoDate } from '@/lib/utils';

/**
 * Wired to the real backend (`GET /reports/fully-paid`, JSON counterpart of the existing `.xlsx`
 * export). Only 7 columns total - all shown always, no column picker needed (unlike the wider
 * reports, e.g. Loan Releases/Expected Collection).
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
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  const buildParams = React.useCallback(() => {
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    return params;
  }, [range.from, range.to]);

  const reportQuery = useQuery({
    queryKey: ['reports', 'fully-paid', range.from, range.to],
    queryFn: () => apiClient.get<{ items: FullyPaidAccountsReportRow[] }>(`/reports/fully-paid?${buildParams().toString()}`),
  });
  const rows = reportQuery.data?.items ?? [];

  const totalLoanAmount = rows.reduce((sum, r) => sum + Number(r.loanAmount), 0);

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const query = buildParams().toString();
      await downloadFile(`/reports/fully-paid.xlsx${query ? `?${query}` : ''}`, 'Fully Paid Accounts.xlsx');
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : 'Could not reach the server. Check your connection and try again.');
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

      {(reportQuery.isError || downloadError) && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {downloadError ?? 'Could not load the report. Check your connection and try again.'}
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
            <Button onClick={handleDownload} disabled={isDownloading} className="ml-auto">
              <Download className="mr-2 h-4 w-4" />
              {isDownloading ? 'Preparing…' : 'Download report'}
            </Button>
          </div>

          <div className="rounded-md border">
            <div className="max-h-[600px] overflow-auto">
              <Table containerClassName="w-full" className="text-xs [&_td]:whitespace-nowrap [&_td]:px-2 [&_td]:py-1.5">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Account ID</TableHead>
                    <TableHead className="text-right">Loan Amount</TableHead>
                    <TableHead>Maturity Date</TableHead>
                    <TableHead>Fully Paid Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6">
                        <ReportLoadingProgress stages={['Fetching fully paid accounts', 'Computing maturity figures']} />
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No accounts fully paid in this date range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r, idx) => (
                      <TableRow key={`${r.accountId}-${idx}`}>
                        <TableCell className="max-w-[180px] truncate font-medium" title={r.clientName}>
                          {r.clientName}
                        </TableCell>
                        <TableCell>{r.product}</TableCell>
                        <TableCell className="font-mono">{r.accountId}</TableCell>
                        <TableCell className="text-right">{formatPeso(Number(r.loanAmount))}</TableCell>
                        <TableCell>{r.maturityDate ? formatDate(r.maturityDate) : '—'}</TableCell>
                        <TableCell>{r.fullyPaidDate ? formatDate(r.fullyPaidDate) : '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {rows.length > 0 && (
                  <tfoot className="sticky bottom-0 z-10 bg-background">
                    <TableRow className="border-t-2 font-semibold hover:bg-transparent">
                      <TableCell colSpan={3}>Total ({rows.length} account{rows.length === 1 ? '' : 's'})</TableCell>
                      <TableCell className="text-right">{formatPeso(totalLoanAmount)}</TableCell>
                      <TableCell />
                      <TableCell />
                    </TableRow>
                  </tfoot>
                )}
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <RecentActivityPanel label="Fully Paid Accounts Report" />
    </div>
  );
}
