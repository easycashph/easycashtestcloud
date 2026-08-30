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
import { ReportLoadingProgress } from '@/components/ReportLoadingProgress';
import { useLogPageView } from '@/lib/activityLog';
import { apiClient, downloadFile, ApiError } from '@/lib/apiClient';
import type { AccountsWithPastDueReportRow } from '@/lib/reportApiTypes';
import { formatDate, formatPeso, isoDate } from '@/lib/utils';

/**
 * 2026-08-20 (user request): the remaining 7 of 14 columns, hidden by default - Client Name/
 * Product/Account ID/Due Date/Current Amount Due/Past Amount Due/Days Late stay always-visible
 * (the minimum needed to identify a row and its headline past-due figures at a glance), same
 * convention as ExpectedCollectionReportPage's OPTIONAL_COLUMNS.
 */
const OPTIONAL_COLUMNS = [
  { key: 'accountState', label: 'Account State' },
  { key: 'maturityDate', label: 'Maturity Date' },
  { key: 'lastPaidDate', label: 'Last Paid Date' },
  { key: 'repayment', label: 'Repayment' },
  { key: 'lackOrExcess', label: 'Lack / Excess' },
  { key: 'repaymentState', label: 'Repayment State' },
  { key: 'countOfPaidDue', label: 'Count of Paid Due' },
] as const;

type OptionalColumnKey = (typeof OPTIONAL_COLUMNS)[number]['key'];
const MONEY_COLUMN_KEYS = new Set<OptionalColumnKey>(['repayment', 'lackOrExcess']);
const DATE_COLUMN_KEYS = new Set<OptionalColumnKey>(['maturityDate', 'lastPaidDate']);

const COLUMN_VISIBILITY_STORAGE_KEY = 'accounts-past-due-report-visible-columns';

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

function optionalCellValue(row: AccountsWithPastDueReportRow, key: OptionalColumnKey): React.ReactNode {
  const value = row[key];
  if (value === null || value === undefined || value === '') return '—';
  if (DATE_COLUMN_KEYS.has(key)) return formatDate(value as string);
  if (MONEY_COLUMN_KEYS.has(key)) return formatPeso(Number(value));
  return String(value);
}

/**
 * Wired to the real backend (`GET /reports/accounts-past-due`, JSON counterpart of the existing
 * `.xlsx` export). On-screen table mirrors Expected Collection Report's shape (scrollable body,
 * sticky total row, column picker) - the `.xlsx` download always includes every column regardless
 * of what's toggled visible here.
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

  const reportQuery = useQuery({
    queryKey: ['reports', 'accounts-past-due', range.from, range.to],
    queryFn: () => apiClient.get<{ items: AccountsWithPastDueReportRow[] }>(`/reports/accounts-past-due?${buildParams().toString()}`),
  });
  const rows = reportQuery.data?.items ?? [];

  const totals = rows.reduce(
    (acc, r) => {
      acc.currentAmountDue += Number(r.currentAmountDue);
      acc.pastAmountDue += Number(r.pastAmountDue);
      return acc;
    },
    { currentAmountDue: 0, pastAmountDue: 0 },
  );

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const query = buildParams().toString();
      await downloadFile(`/reports/accounts-past-due.xlsx${query ? `?${query}` : ''}`, 'Accounts with Past Due.xlsx');
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : 'Could not reach the server. Check your connection and try again.');
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

      {(reportQuery.isError || downloadError) && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {downloadError ?? 'Could not load the report. Check your connection and try again.'}
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
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Current Amount Due</TableHead>
                    <TableHead className="text-right">Past Amount Due</TableHead>
                    <TableHead className="text-right">Days Late</TableHead>
                    {visibleOptionalColumns.map((c) => (
                      <TableHead key={c.key} className={MONEY_COLUMN_KEYS.has(c.key) ? 'text-right' : undefined}>
                        {c.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7 + visibleOptionalColumns.length} className="py-6">
                        <ReportLoadingProgress stages={['Fetching past due accounts', 'Computing lateness figures']} />
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7 + visibleOptionalColumns.length} className="text-center text-muted-foreground">
                        No overdue accounts in this date range.
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
                        <TableCell>{formatDate(r.dueDate)}</TableCell>
                        <TableCell className="text-right">{formatPeso(Number(r.currentAmountDue))}</TableCell>
                        <TableCell className="text-right">{formatPeso(Number(r.pastAmountDue))}</TableCell>
                        <TableCell className="text-right">{r.daysLate}</TableCell>
                        {visibleOptionalColumns.map((c) => (
                          <TableCell key={c.key} className={MONEY_COLUMN_KEYS.has(c.key) ? 'text-right' : undefined}>
                            {optionalCellValue(r, c.key)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {rows.length > 0 && (
                  <tfoot className="sticky bottom-0 z-10 bg-background">
                    <TableRow className="border-t-2 font-semibold hover:bg-transparent">
                      <TableCell colSpan={4}>Total ({rows.length} account{rows.length === 1 ? '' : 's'})</TableCell>
                      <TableCell className="text-right">{formatPeso(totals.currentAmountDue)}</TableCell>
                      <TableCell className="text-right">{formatPeso(totals.pastAmountDue)}</TableCell>
                      <TableCell />
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

      <RecentActivityPanel label="Accounts with Past Due Report" />
    </div>
  );
}
