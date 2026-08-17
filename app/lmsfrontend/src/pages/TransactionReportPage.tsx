import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronDown, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { DateRangeFilter, type DateRange } from '@/components/DateRangeFilter';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useSortableTable } from '@/lib/useSortableTable';
import { apiClient, downloadFile, fetchAllPages, ApiError } from '@/lib/apiClient';
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
  'FEE_REPAYMENT',
  'PENALTY_REPAYMENT',
];

/**
 * 2026-08-15 (user request): the channel filter's default selection - every real collection
 * channel, deliberately excluding `Adjustment` (not a real payment channel), `Loan Deduct` (its
 * own payroll-deduction workflow, and the one channel that turned out to be missing entirely from
 * SDevTech's own Daily Collection Report export - see the session log), and `Suspense Account`
 * (not a settled collection). A channel not in this list still appears in the dropdown and can be
 * ticked manually - it's just unchecked on first load.
 */
const DEFAULT_CHANNEL_LABELS = [
  'GCash',
  'Cash',
  'Bank Transfer',
  'ATM',
  'Check',
  'Post Dated Checks',
  'ADA',
  'Bank',
  'Receipt',
  'Unearned Income',
  'Dragonpay',
  'Lazada Wallet',
];

/**
 * The three types that represent money actually collected from a borrower — the page's default
 * filter, and what the "Payments only" shortcut selects. `FEE_REPAYMENT`/`PENALTY_REPAYMENT` only
 * ever appear on migrated SDevTech rows (this system records one REPAYMENT with fee/penalty
 * components instead), but they are real collections and must not be left out of a collection
 * report — leaving them out is exactly the bug this default fixes.
 *
 * 2026-08-16: `FEE_CHARGED` was briefly added here for an SDevTech reconciliation check, then
 * reverted the same day — it's an *assessment* (increases what's owed), not money collected, and
 * double-counted a fee that was charged and paid within the same date range (once as the charge,
 * again as its later REPAYMENT/FEE_REPAYMENT). Confirmed via the reconciliation itself: the total
 * only matched with `FEE_CHARGED` unchecked. Keep it out of the default.
 */
const PAYMENT_TYPES: LoanTransactionType[] = ['REPAYMENT', 'FEE_REPAYMENT', 'PENALTY_REPAYMENT'];

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
  // Green like REPAYMENT — these ARE real borrower payments (migrated SDevTech history), not the
  // staff corrections ADJUSTMENT's amber signals.
  FEE_REPAYMENT: 'success',
  PENALTY_REPAYMENT: 'success',
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
  /**
   * 2026-08-15 (user request): multi-select. This was a single-value dropdown defaulting to
   * REPAYMENT, which silently hid real collections — a migrated SDevTech payment that settled a fee
   * or penalty is its own type (FEE_REPAYMENT/PENALTY_REPAYMENT), so filtering to "REPAYMENT" alone
   * left those out of the report entirely. Defaults to all three payment types together for that
   * reason. Empty array = no filter (every type), matching the backend's own `types` semantics.
   */
  const [types, setTypes] = React.useState<LoanTransactionType[]>(PAYMENT_TYPES);
  /**
   * 2026-08-15 (user request): multi-select channel filter, same pattern as the type filter above.
   * Empty array = no filter (every channel). Unlike type, there's no smart default here — a
   * migrated payment's channel is whatever SDevTech recorded (e.g. "Loan Deduct"), not a bug to
   * default around.
   *
   * Tracked by LABEL, not raw stored value — a native code (e.g. "BANK_TRANSFER") and its migrated
   * counterpart ("Bank Transfer") can both resolve to one label/checkbox (`ChannelOption.values`
   * holds every raw value that maps to it), so a single selection has to expand into possibly
   * several `channel` query params. See the backend's `PAYMENT_METHOD_LABEL` doc comment.
   */
  const [channelLabels, setChannelLabels] = React.useState<string[]>(DEFAULT_CHANNEL_LABELS);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  const channelsQuery = useQuery({
    queryKey: ['reports', 'transaction-channels'],
    queryFn: () => apiClient.get<{ items: { label: string; values: string[] }[] }>('/reports/transactions/channels'),
  });
  const channelOptions = channelsQuery.data?.items ?? [];

  /** Repeated `type`/`channel` params — the backend normalises one or many into a single list. */
  const buildParams = React.useCallback(() => {
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    for (const t of types) params.append('type', t);
    for (const label of channelLabels) {
      const option = channelOptions.find((c) => c.label === label);
      for (const value of option?.values ?? [label]) params.append('channel', value);
    }
    return params;
  }, [range.from, range.to, types, channelLabels, channelOptions]);

  const toggleType = (t: LoanTransactionType) => {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };
  const toggleChannel = (label: string) => {
    setChannelLabels((prev) => (prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]));
  };

  const typeFilterLabel =
    types.length === 0
      ? 'All types'
      : types.length === 1
        ? (types[0] as string).replaceAll('_', ' ')
        : `${types.length} types selected`;
  const channelFilterLabel =
    channelLabels.length === 0
      ? 'All channels'
      : channelLabels.length === 1
        ? channelLabels[0]!
        : `${channelLabels.length} channels selected`;

  const transactionsQuery = useQuery({
    queryKey: ['reports', 'transactions', range.from, range.to, [...types].sort().join(','), [...channelLabels].sort().join(',')],
    queryFn: () => {
      const query = buildParams().toString();
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
      const query = buildParams().toString();
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-56 justify-between font-normal">
                  <span className="truncate">{typeFilterLabel}</span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              {/* Checkbox items keep the menu open on select (Radix closes on DropdownMenuItem but
                  not on CheckboxItem), so several types can be ticked in one go. */}
              <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
                <DropdownMenuItem onSelect={() => setTypes(PAYMENT_TYPES)}>Payments only</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTypes([])}>All types</DropdownMenuItem>
                <DropdownMenuSeparator />
                {TRANSACTION_TYPES.map((t) => (
                  <DropdownMenuCheckboxItem
                    key={t}
                    checked={types.includes(t)}
                    onCheckedChange={() => toggleType(t)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {t.replaceAll('_', ' ')}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-56 justify-between font-normal">
                  <span className="truncate">{channelFilterLabel}</span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
                <DropdownMenuItem onSelect={() => setChannelLabels(DEFAULT_CHANNEL_LABELS)}>Default channels</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setChannelLabels([])}>All channels</DropdownMenuItem>
                <DropdownMenuSeparator />
                {channelOptions.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.label}
                    checked={channelLabels.includes(c.label)}
                    onCheckedChange={() => toggleChannel(c.label)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {c.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
          <div ref={scrollBoxRef} onScroll={updateScrollHint} className="max-h-[820px] overflow-auto">
          <Table containerClassName="w-full" className="text-xs [&_td]:whitespace-nowrap [&_td]:px-2 [&_td]:py-1.5">
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
