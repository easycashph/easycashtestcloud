import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { ReportLoadingProgress } from '@/components/ReportLoadingProgress';
import { useLogPageView } from '@/lib/activityLog';
import { apiClient, downloadFile, ApiError } from '@/lib/apiClient';
import type { CicMonthlyReportSummary } from '@/lib/reportApiTypes';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SKIP_REASON_LABEL: Record<CicMonthlyReportSummary['skippedMissingSubjectNo'][number]['reason'], string> = {
  MISSING_SUBJECT_NO: 'Borrower missing permanent CIC ID',
  MISSING_CONTRACT_NO: 'Loan missing permanent CIC contract ID',
};

// One request on the backend, but it genuinely does these three things in sequence.
const LOADING_STAGES = ['Fetching loans in scope', 'Resolving CIC identifiers', 'Computing balances and overdue figures'];

export function CicMonthlyReportPage() {
  useLogPageView('CIC Monthly Report');
  const now = new Date();
  // Default to last month - the reporting period a monthly submission actually covers is
  // typically the one that just closed, not the one still in progress.
  const defaultDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [year, setYear] = React.useState(defaultDate.getFullYear());
  const [month, setMonth] = React.useState(defaultDate.getMonth() + 1);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  const yearOptions = React.useMemo(() => {
    const currentYear = now.getFullYear();
    // CIC reporting only started in 2019 - years before that were never in scope (see backend's
    // getCicMonthlyReportData doc comment), so there's no point offering them here.
    const years: number[] = [];
    for (let y = currentYear; y >= 2019; y--) years.push(y);
    return years;
  }, [now]);

  const reportQuery = useQuery({
    queryKey: ['reports', 'cic-monthly', year, month],
    queryFn: () => apiClient.get<CicMonthlyReportSummary>(`/reports/cic-monthly?year=${year}&month=${month}`),
  });
  const summary = reportQuery.data;

  const handleDownload = async (format: 'csv' | 'xlsx') => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const monthLabel = String(month).padStart(2, '0');
      const fallbackName = format === 'csv' ? `PF017290_CSDF_${year}${monthLabel}.csv` : `CIC Monthly Report ${year}-${monthLabel}.xlsx`;
      await downloadFile(`/reports/cic-monthly.${format}?year=${year}&month=${month}`, fallbackName);
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : 'Could not reach the server. Check your connection and try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const skipped = summary?.skippedMissingSubjectNo ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">CIC Monthly Report</h2>
        <p className="text-sm text-muted-foreground">
          Credit Information Corporation submission file (ID + Installment Contract records) for the selected reporting month.
        </p>
      </div>

      {(reportQuery.isError || downloadError) && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {downloadError ?? 'Could not load the report. Check your connection and try again.'}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reporting period</CardTitle>
          <CardDescription>The generated file covers every open loan, plus any loan that closed during this month.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((label, idx) => (
                  <SelectItem key={label} value={String(idx + 1)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => handleDownload('xlsx')} disabled={isDownloading || reportQuery.isLoading}>
                <Download className="mr-2 h-4 w-4" />
                {isDownloading ? 'Preparing…' : 'Download Excel (for review)'}
              </Button>
              <Button onClick={() => handleDownload('csv')} disabled={isDownloading || reportQuery.isLoading}>
                <Download className="mr-2 h-4 w-4" />
                {isDownloading ? 'Preparing…' : 'Download CSDF file'}
              </Button>
            </div>
          </div>

          {reportQuery.isLoading ? (
            <div className="rounded-md border bg-muted/30 p-4">
              <ReportLoadingProgress stages={LOADING_STAGES} />
            </div>
          ) : summary ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Individuals</p>
                <p className="text-2xl font-semibold tabular-nums">{summary.individualCount}</p>
              </div>
              <div className="rounded-md bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Contracts</p>
                <p className="text-2xl font-semibold tabular-nums">{summary.contractCount}</p>
              </div>
              <div className={`rounded-md p-4 ${skipped.length > 0 ? 'bg-amber-500/10' : 'bg-muted/50'}`}>
                <p className={`text-xs ${skipped.length > 0 ? 'text-amber-700 dark:text-amber-500' : 'text-muted-foreground'}`}>Excluded</p>
                <p className={`text-2xl font-semibold tabular-nums ${skipped.length > 0 ? 'text-amber-700 dark:text-amber-500' : ''}`}>
                  {skipped.length}
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {skipped.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Excluded from this file
            </CardTitle>
            <CardDescription>
              These loans are missing a permanent CIC identifier (borrower or loan) and were left out rather than submitted with a fabricated
              one. Assign the missing ID, then regenerate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <div className="max-h-[400px] overflow-auto">
                <Table containerClassName="w-full" className="text-xs [&_td]:whitespace-nowrap [&_td]:px-2 [&_td]:py-1.5">
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>Loan Code</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {skipped.map((row) => (
                      <TableRow key={row.loanCode}>
                        <TableCell className="font-mono">{row.loanCode}</TableCell>
                        <TableCell>{row.borrowerName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {SKIP_REASON_LABEL[row.reason]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <RecentActivityPanel label="CIC Monthly Report" />
    </div>
  );
}
