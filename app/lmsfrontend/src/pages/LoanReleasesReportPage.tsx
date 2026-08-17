import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Columns3, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DateRangeFilter, type DateRange } from '@/components/DateRangeFilter';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { apiClient, downloadFile, ApiError } from '@/lib/apiClient';
import type { LoanReleaseReportRow } from '@/lib/reportApiTypes';
import { formatDate, formatPeso, isoDate } from '@/lib/utils';

/**
 * 2026-08-17 (user request): the remaining 22 of 28 columns, hidden by default - Client Name/
 * Product/Account ID/Disbursement Date/Loan Amount/Total Net Amount stay always-visible (the
 * minimum needed to identify a row and its headline figures at a glance), same convention as
 * PaymentRemindersPage's OPTIONAL_COLUMNS. Persisted per-browser via localStorage, not per-user on
 * the backend - a display preference, not worth a server round-trip.
 */
const OPTIONAL_COLUMNS = [
  { key: 'clientId', label: 'Client ID' },
  { key: 'address', label: 'Address' },
  { key: 'agencyCompany', label: 'Agency / Company' },
  { key: 'loanCreated', label: 'Loan Created' },
  { key: 'maturityDate', label: 'Maturity Date' },
  { key: 'term', label: 'Term' },
  { key: 'nthLoan', label: 'Nth Loan' },
  { key: 'newOrRenew', label: 'New / Renew' },
  { key: 'firstRepaymentDate', label: 'First Repayment Date' },
  { key: 'amortization', label: 'Amortization' },
  { key: 'totalInterest', label: 'Total Interest' },
  { key: 'totalOB', label: 'Total OB' },
  { key: 'addOnInterestRate', label: 'Add-on Interest Rate' },
  { key: 'contractualInterestRate', label: 'Contractual Interest Rate' },
  { key: 'advanceInterestFee', label: 'Advance Interest Fee' },
  { key: 'processingFee', label: 'Processing Fee' },
  { key: 'documentationFee', label: 'Documentation Fee' },
  { key: 'outstandingLoanBalance', label: 'Outstanding Loan Balance' },
  { key: 'accountManagementFee', label: 'Account Management Fee' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'notarial', label: 'Notarial' },
  { key: 'webFee', label: 'Web Fee' },
] as const;

type OptionalColumnKey = (typeof OPTIONAL_COLUMNS)[number]['key'];
const MONEY_COLUMN_KEYS = new Set<OptionalColumnKey>([
  'amortization',
  'totalInterest',
  'totalOB',
  'advanceInterestFee',
  'processingFee',
  'documentationFee',
  'outstandingLoanBalance',
  'accountManagementFee',
  'insurance',
  'notarial',
  'webFee',
]);
const DATE_COLUMN_KEYS = new Set<OptionalColumnKey>(['loanCreated', 'maturityDate', 'firstRepaymentDate']);
const PERCENT_COLUMN_KEYS = new Set<OptionalColumnKey>(['addOnInterestRate', 'contractualInterestRate']);

const COLUMN_VISIBILITY_STORAGE_KEY = 'loan-releases-report-visible-columns';

function loadColumnVisibility(): Record<OptionalColumnKey, boolean> {
  const defaults = Object.fromEntries(OPTIONAL_COLUMNS.map((c) => [c.key, false])) as Record<OptionalColumnKey, boolean>;
  try {
    const stored = window.localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY);
    if (!stored) return defaults;
    return { ...defaults, ...JSON.parse(stored) };
  } catch {
    return defaults;
  }
}

function optionalCellValue(row: LoanReleaseReportRow, key: OptionalColumnKey): React.ReactNode {
  const value = row[key];
  if (value === null || value === undefined) return '—';
  if (DATE_COLUMN_KEYS.has(key)) return formatDate(value as string);
  if (MONEY_COLUMN_KEYS.has(key)) return formatPeso(Number(value));
  if (PERCENT_COLUMN_KEYS.has(key)) return `${value}%`;
  return String(value);
}

/**
 * Wired to the real backend (`GET /reports/loan-releases`, JSON counterpart of the existing
 * `.xlsx` export). On-screen table mirrors Transaction Report's shape (scrollable body, sticky
 * total row) - the `.xlsx` download always includes every column regardless of what's toggled
 * visible here (user-confirmed 2026-08-17): the column picker is a display preference, not a
 * report-scope filter.
 */
export function LoanReleasesReportPage() {
  useLogPageView('Loan Releases Report');
  const [range, setRange] = React.useState<DateRange>(() => {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    return { from: isoDate(from), to: isoDate(to) };
  });
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = React.useState<Record<OptionalColumnKey, boolean>>(loadColumnVisibility);
  React.useEffect(() => {
    window.localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);
  const toggleColumn = (key: OptionalColumnKey) => setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  const visibleOptionalColumns = OPTIONAL_COLUMNS.filter((c) => visibleColumns[c.key]);

  const buildParams = React.useCallback(() => {
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    return params;
  }, [range.from, range.to]);

  const releasesQuery = useQuery({
    queryKey: ['reports', 'loan-releases', range.from, range.to],
    queryFn: () => apiClient.get<{ items: LoanReleaseReportRow[] }>(`/reports/loan-releases?${buildParams().toString()}`),
  });
  const releases = releasesQuery.data?.items ?? [];

  const totals = releases.reduce(
    (acc, r) => {
      acc.loanAmount += Number(r.loanAmount);
      acc.totalNetAmount += Number(r.totalNetAmount);
      return acc;
    },
    { loanAmount: 0, totalNetAmount: 0 },
  );

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const query = buildParams().toString();
      await downloadFile(`/reports/loan-releases.xlsx${query ? `?${query}` : ''}`, 'Monthly Loan Releases.xlsx');
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : 'Could not reach the server. Check your connection and try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Loan Releases Report</h2>
        <p className="text-sm text-muted-foreground">
          Every loan disbursed in the selected date range, one row per loan - a like-for-like replacement of the legacy Monthly
          Loan Releases spreadsheet.
        </p>
      </div>

      {(releasesQuery.isError || downloadError) && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {downloadError ?? 'Could not load the report. Check your connection and try again.'}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Date range filters on Disbursement Date. Defaults to the current month.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <DateRangeFilter value={range} onChange={setRange} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Columns3 className="mr-1.5 h-4 w-4" /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
                <DropdownMenuLabel>Optional columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {OPTIONAL_COLUMNS.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.key}
                    checked={visibleColumns[column.key]}
                    onCheckedChange={() => toggleColumn(column.key)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
                    <TableHead>Disbursement Date</TableHead>
                    <TableHead className="text-right">Loan Amount</TableHead>
                    <TableHead className="text-right">Total Net Amount</TableHead>
                    {visibleOptionalColumns.map((c) => (
                      <TableHead key={c.key} className={MONEY_COLUMN_KEYS.has(c.key) ? 'text-right' : undefined}>
                        {c.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {releasesQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6 + visibleOptionalColumns.length} className="text-center text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : releases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6 + visibleOptionalColumns.length} className="text-center text-muted-foreground">
                        No loans disbursed in this date range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    releases.map((r) => (
                      <TableRow key={r.accountId}>
                        <TableCell className="font-medium">{r.clientName}</TableCell>
                        <TableCell>{r.product}</TableCell>
                        <TableCell className="font-mono">{r.accountId}</TableCell>
                        <TableCell>{formatDate(r.disbursementDate)}</TableCell>
                        <TableCell className="text-right">{formatPeso(Number(r.loanAmount))}</TableCell>
                        <TableCell className="text-right">{formatPeso(Number(r.totalNetAmount))}</TableCell>
                        {visibleOptionalColumns.map((c) => (
                          <TableCell key={c.key} className={MONEY_COLUMN_KEYS.has(c.key) ? 'text-right' : undefined}>
                            {optionalCellValue(r, c.key)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {releases.length > 0 && (
                  <tfoot className="sticky bottom-0 z-10 bg-background">
                    <TableRow className="border-t-2 font-semibold hover:bg-transparent">
                      <TableCell colSpan={4}>Total ({releases.length} loan{releases.length === 1 ? '' : 's'})</TableCell>
                      <TableCell className="text-right">{formatPeso(totals.loanAmount)}</TableCell>
                      <TableCell className="text-right">{formatPeso(totals.totalNetAmount)}</TableCell>
                      {visibleOptionalColumns.map((c) => (
                        <TableCell key={c.key} />
                      ))}
                    </TableRow>
                  </tfoot>
                )}
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <RecentActivityPanel label="Loan Releases Report" />
    </div>
  );
}
