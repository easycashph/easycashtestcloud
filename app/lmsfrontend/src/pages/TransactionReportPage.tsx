import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronDown, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { DateRangeFilter, type DateRange } from '@/components/DateRangeFilter';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useSortableTable } from '@/lib/useSortableTable';
import { downloadFile, fetchAllPages, ApiError } from '@/lib/apiClient';
import type { LoanTransactionType, TransactionReportRow } from '@/lib/reportApiTypes';
import { formatDate, formatPeso, isoDate } from '@/lib/utils';


const TRANSACTION_TYPES: LoanTransactionType[] = [
  'DISBURSEMENT',
  'REPAYMENT',
  'FEE_CHARGED',
  'PENALTY_APPLIED',
  'INTEREST_APPLIED',
  'DEFERRED_INTEREST_APPLIED',
  'DEFERRED_INTEREST_PAID',
  'TRANSFER',
  'ADJUSTMENT',
  'REVERSAL',
];

function getSortValue(txn: TransactionReportRow, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'entryDate':
      return new Date(txn.entryDate);
    case 'loanCode':
      return txn.loanCode;
    case 'borrowerName':
      return txn.borrowerName;
    case 'type':
      return txn.type;
    case 'branchName':
      return txn.branchName;
    case 'amount':
      return Number(txn.amount);
    default:
      return undefined;
  }
}

const TYPE_BADGE_VARIANT: Record<LoanTransactionType, 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'outline'> = {
  DISBURSEMENT: 'default',
  REPAYMENT: 'success',
  FEE_CHARGED: 'secondary',
  PENALTY_APPLIED: 'destructive',
  INTEREST_APPLIED: 'outline',
  DEFERRED_INTEREST_APPLIED: 'outline',
  DEFERRED_INTEREST_PAID: 'outline',
  TRANSFER: 'secondary',
  ADJUSTMENT: 'warning',
  REVERSAL: 'destructive',
};

/** Shows "—" for a zero/blank money or text value, same convention as the Repayment Schedule table. */
function moneyOrDash(value: string): string {
  const n = Number(value);
  return n > 0 ? formatPeso(n) : '—';
}
function textOrDash(value: string): string {
  return value.trim() ? value : '—';
}

/**
 * Wired to the real backend (`GET /reports/transactions`).
 *
 * 2026-08-05 (user-confirmed, mocked up first): column order matches the Daily Collection Report
 * export exactly (same underlying data - `listTransactions` reuses `getDailyCollectionReport`'s own
 * field computation) - every component amount, OR#/AR#/Channel, and Expected Maturity Date is now a
 * direct column instead of a click-to-expand breakdown row. "Download report" reuses the existing
 * Daily Collection Report .xlsx export, since it's the same data this table shows.
 */
export function TransactionReportPage() {
  useLogPageView('Transaction Report');
  const [range, setRange] = React.useState<DateRange>(() => {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    return { from: isoDate(from), to: isoDate(to) };
  });
  const [type, setType] = React.useState<LoanTransactionType | 'ALL'>('ALL');
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  const transactionsQuery = useQuery({
    queryKey: ['reports', 'transactions', range.from, range.to, type],
    queryFn: () => {
      const params = new URLSearchParams();
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);
      if (type !== 'ALL') params.set('type', type);
      const query = params.toString();
      return fetchAllPages<TransactionReportRow>(`/reports/transactions${query ? `?${query}` : ''}`);
    },
  });
  const transactions = transactionsQuery.data ?? [];
  const { sorted, sort, toggleSort } = useSortableTable(transactions, getSortValue, { key: 'entryDate', direction: 'desc' });

  const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

  // 2026-08-06 (user request, mocked up first): a fixed-height scrollable table gives no visual cue
  // that rows exist below the fold - this fade + "N more below" chip (hidden once scrolled to the
  // bottom) is that cue, same pattern as Notion/Linear-style data tables. ~29px is this table's own
  // row height (text-xs + the [&_td]:py-1.5 override below) - approximate is fine, it's a hint, not
  // a precise count.
  const ROW_HEIGHT_PX = 29;
  const scrollBoxRef = React.useRef<HTMLDivElement>(null);
  const [rowsBelowFold, setRowsBelowFold] = React.useState(0);
  const updateScrollHint = React.useCallback(() => {
    const el = scrollBoxRef.current;
    if (!el) return;
    const pixelsBelow = el.scrollHeight - el.scrollTop - el.clientHeight;
    setRowsBelowFold(pixelsBelow > 8 ? Math.max(1, Math.round(pixelsBelow / ROW_HEIGHT_PX)) : 0);
  }, []);
  React.useEffect(() => {
    updateScrollHint();
  }, [sorted, updateScrollHint]);

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const params = new URLSearchParams();
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);
      if (type !== 'ALL') params.set('type', type);
      const query = params.toString();
      await downloadFile(`/reports/daily-collection.xlsx${query ? `?${query}` : ''}`, 'Daily Collection Report.xlsx');
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : 'Could not reach the server. Check your connection and try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Transaction Report</h2>
        <p className="text-sm text-muted-foreground">{transactions.length} ledger entr{transactions.length === 1 ? 'y' : 'ies'}.</p>
      </div>

      {transactionsQuery.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Could not load the transaction report. Is the backend running?
        </div>
      )}
      {downloadError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {downloadError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Date range and transaction type filter the query sent to the server.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <DateRangeFilter value={range} onChange={setRange} />
            <Select value={type} onValueChange={(v) => setType(v as LoanTransactionType | 'ALL')}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All types</SelectItem>
                {TRANSACTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replaceAll('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleDownload} disabled={isDownloading}>
              <Download className="mr-2 h-4 w-4" />
              {isDownloading ? 'Preparing…' : 'Download report'}
            </Button>
          </div>

          {/* 2026-08-06 (user request): every matching row is already fetched (fetchAllPages above) -
              rather than paginate, show ~25 rows at a time and let the rest scroll within this fixed-
              height box. Header stays pinned while scrolling; Total stays pinned to the bottom
              (sticky, not inside the scrolling body) so it's always visible regardless of scroll
              position. */}
          <div className="relative rounded-md border">
          <div ref={scrollBoxRef} onScroll={updateScrollHint} className="max-h-[820px] overflow-y-auto">
          <Table className="text-xs [&_td]:whitespace-nowrap [&_td]:px-2 [&_td]:py-1.5">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <SortableTableHead sortKey="borrowerName" currentSort={sort} onSort={toggleSort}>
                  Full Name (Client)
                </SortableTableHead>
                <TableHead>Product ID</TableHead>
                <SortableTableHead sortKey="loanCode" currentSort={sort} onSort={toggleSort}>
                  Account ID
                </SortableTableHead>
                <TableHead className="text-right">Total Balance</TableHead>
                <SortableTableHead sortKey="amount" currentSort={sort} onSort={toggleSort} className="text-right">
                  Amount
                </SortableTableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Interest</TableHead>
                <TableHead className="text-right">Fees</TableHead>
                <TableHead className="text-right">Penalty</TableHead>
                <TableHead>Expected Maturity Date</TableHead>
                <SortableTableHead sortKey="entryDate" currentSort={sort} onSort={toggleSort} isDateColumn>
                  Value Date (Entry Date)
                </SortableTableHead>
                <TableHead>OR Number</TableHead>
                <TableHead>AR Number</TableHead>
                <TableHead>Channel</TableHead>
                <SortableTableHead sortKey="type" currentSort={sort} onSort={toggleSort}>
                  Type
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell>{txn.borrowerName}</TableCell>
                  <TableCell>{txn.productId}</TableCell>
                  <TableCell className="font-mono text-xs">{txn.loanCode}</TableCell>
                  <TableCell className="text-right">{moneyOrDash(txn.totalBalance)}</TableCell>
                  <TableCell className="text-right font-medium">{moneyOrDash(txn.amount)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{moneyOrDash(txn.components.principal)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{moneyOrDash(txn.components.interest)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{moneyOrDash(txn.components.fees)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{moneyOrDash(txn.components.penalty)}</TableCell>
                  <TableCell>{txn.expectedMaturityDate ? formatDate(txn.expectedMaturityDate) : '—'}</TableCell>
                  <TableCell>{formatDate(txn.entryDate)}</TableCell>
                  <TableCell className="text-muted-foreground">{textOrDash(txn.orNumber)}</TableCell>
                  <TableCell className="text-muted-foreground">{textOrDash(txn.arNumber)}</TableCell>
                  <TableCell className="text-muted-foreground">{textOrDash(txn.channel)}</TableCell>
                  <TableCell>
                    <Badge variant={TYPE_BADGE_VARIANT[txn.type]}>{txn.type.replaceAll('_', ' ')}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={14} className="py-8 text-center text-sm text-muted-foreground">
                    {transactionsQuery.isLoading ? 'Loading…' : 'No transactions match these filters.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter className="sticky bottom-0 z-10">
              <TableRow>
                <TableCell colSpan={4}>Total ({transactions.length} entries)</TableCell>
                <TableCell className="text-right">{formatPeso(total)}</TableCell>
                <TableCell colSpan={9} />
              </TableRow>
            </TableFooter>
          </Table>
          </div>
          {rowsBelowFold > 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-9 flex h-12 items-end justify-center bg-gradient-to-b from-transparent to-background">
              <span className="mb-1.5 flex items-center gap-1 rounded-full border bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                <ChevronDown className="h-3 w-3" /> {rowsBelowFold} more below
              </span>
            </div>
          )}
          </div>
        </CardContent>
      </Card>

      <RecentActivityPanel label="Transaction Report" />
    </div>
  );
}
