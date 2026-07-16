import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, Clock, Columns3, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { DateRangeFilter, type DateRange } from '@/components/DateRangeFilter';
import { PaginationControls } from '@/components/PaginationControls';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useSortableTable } from '@/lib/useSortableTable';
import { apiClient } from '@/lib/apiClient';
import type { PaymentReminder, PaymentReminderStatus } from '@/lib/paymentReminderApiTypes';
import { formatDate, formatPeso } from '@/lib/utils';

/**
 * 2026-07-11 (user request): this table has enough columns to force horizontal scrolling on most
 * screens — lets staff hide the ones they don't need right now. Loan Account/Borrower/Status are
 * not offered here (kept always visible — the minimum needed to identify a row at a glance).
 * Persisted per-browser via localStorage, not per-user on the backend — a simple display
 * preference, not worth a server round-trip.
 */
const OPTIONAL_COLUMNS = [
  { key: 'dueDate', label: 'Due Date' },
  { key: 'principalDue', label: 'Principal Due' },
  { key: 'interestDue', label: 'Interest Due' },
  { key: 'penaltyDue', label: 'Penalty Due' },
  { key: 'feesDue', label: 'Fees Due' },
  { key: 'amountDue', label: 'Total Amount Due' },
  { key: 'progress', label: 'Progress' },
] as const;

type OptionalColumnKey = (typeof OPTIONAL_COLUMNS)[number]['key'];

const COLUMN_VISIBILITY_STORAGE_KEY = 'payment-reminders-visible-columns';

function loadColumnVisibility(): Record<OptionalColumnKey, boolean> {
  const defaults = Object.fromEntries(OPTIONAL_COLUMNS.map((c) => [c.key, true])) as Record<OptionalColumnKey, boolean>;
  try {
    const stored = window.localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY);
    if (!stored) return defaults;
    return { ...defaults, ...JSON.parse(stored) };
  } catch {
    return defaults;
  }
}

function remainingDue(r: PaymentReminder): number {
  return Number(r.due.total) - Number(r.paid.total);
}

function remainingDueByComponent(r: PaymentReminder) {
  return {
    principal: Number(r.due.principal) - Number(r.paid.principal),
    interest: Number(r.due.interest) - Number(r.paid.interest),
    penalty: Number(r.due.penalty) - Number(r.paid.penalty),
    fees: Number(r.due.fees) - Number(r.paid.fees),
  };
}

function getSortValue(r: PaymentReminder, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'loanCode':
      return r.loanCode;
    case 'borrowerName':
      return r.borrowerName;
    case 'dueDate':
      return new Date(r.dueDate);
    case 'principalDue':
      return remainingDueByComponent(r).principal;
    case 'interestDue':
      return remainingDueByComponent(r).interest;
    case 'penaltyDue':
      return remainingDueByComponent(r).penalty;
    case 'feesDue':
      return remainingDueByComponent(r).fees;
    case 'amountDue':
      return remainingDue(r);
    case 'status':
      return r.status;
    default:
      return undefined;
  }
}

const PAGE_SIZE = 50;

const STATUS_OPTIONS: { value: PaymentReminderStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'LATE', label: 'Overdue' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
  { value: 'PENDING', label: 'Upcoming' },
];

const STATUS_BADGE: Record<PaymentReminderStatus, { variant: 'destructive' | 'warning' | 'outline'; label: string }> = {
  LATE: { variant: 'destructive', label: 'Overdue' },
  PARTIALLY_PAID: { variant: 'warning', label: 'Partially Paid' },
  PENDING: { variant: 'outline', label: 'Upcoming' },
};

/**
 * Wired to the real backend (`GET /payment-reminders`) - one row per active loan account's next
 * not-fully-paid installment. There's no notification/scheduling service in this build yet (no
 * SMS/email actually goes out), so this is an "Upcoming & Overdue Installments" worklist, not a
 * simulated reminder-send history like the earlier mock version.
 */
export function PaymentRemindersPage() {
  useLogPageView('Due & Overdue');
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<PaymentReminderStatus | 'ALL'>('ALL');
  const [dueDateRange, setDueDateRange] = React.useState<DateRange>({ from: '', to: '' });
  const [page, setPage] = React.useState(1);
  const [visibleColumns, setVisibleColumns] = React.useState<Record<OptionalColumnKey, boolean>>(loadColumnVisibility);
  React.useEffect(() => {
    window.localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);
  const toggleColumn = (key: OptionalColumnKey) => setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));

  const remindersQuery = useQuery({
    queryKey: ['payment-reminders'],
    queryFn: () => apiClient.get<{ items: PaymentReminder[] }>('/payment-reminders'),
  });
  const reminders = remindersQuery.data?.items ?? [];

  const filtered = reminders.filter((r) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 || r.borrowerName.toLowerCase().includes(query) || r.loanCode.toLowerCase().includes(query);
    const matchesStatus = status === 'ALL' || r.status === status;
    // Plain string comparison on the ISO-format dueDate - safe since both sides are YYYY-MM-DD,
    // which sorts/compares correctly as strings without needing Date parsing.
    const dueDateOnly = r.dueDate.slice(0, 10);
    const matchesFrom = !dueDateRange.from || dueDateOnly >= dueDateRange.from;
    const matchesTo = !dueDateRange.to || dueDateOnly <= dueDateRange.to;
    return matchesSearch && matchesStatus && matchesFrom && matchesTo;
  });
  const { sorted, sort, toggleSort } = useSortableTable(filtered, getSortValue, { key: 'dueDate', direction: 'asc' });

  // Resets to page 1 whenever the search/status filter, sort order, or the underlying data
  // changes — otherwise a filter/sort could leave the view stranded on a now-empty or
  // no-longer-relevant later page.
  React.useEffect(() => {
    setPage(1);
  }, [search, status, dueDateRange.from, dueDateRange.to, sort.key, sort.direction, reminders.length]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Totals across the whole filtered result (every page), not just the rows currently shown -
  // otherwise the figure would silently change depending on which page the user happens to be on.
  const totals = filtered.reduce(
    (acc, r) => {
      const components = remainingDueByComponent(r);
      acc.principal += components.principal;
      acc.interest += components.interest;
      acc.penalty += components.penalty;
      acc.fees += components.fees;
      acc.amountDue += remainingDue(r);
      return acc;
    },
    { principal: 0, interest: 0, penalty: 0, fees: 0, amountDue: 0 },
  );

  const overdueCount = reminders.filter((r) => r.status === 'LATE').length;
  // Loan Account + Borrower + Status are always visible (2 + 1), plus whichever optional columns are toggled on.
  const visibleColumnCount = 3 + OPTIONAL_COLUMNS.filter((c) => visibleColumns[c.key]).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Due & Overdue</h2>
        <p className="text-sm text-muted-foreground">
          {reminders.length} active loan account{reminders.length === 1 ? '' : 's'} with an installment due or overdue (
          {overdueCount} overdue). Each row is the next unpaid installment for that loan. No SMS/email notification service is wired
          up yet — this is a worklist, not a send history.
        </p>
      </div>

      {remindersQuery.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Could not load payment reminders. Is the backend running?
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3">
          <CardTitle className="text-base">Upcoming &amp; Overdue Installments — Search &amp; Filter</CardTitle>
          <div className="flex flex-col flex-wrap items-end gap-3 sm:flex-row">
            <div className="space-y-1.5">
              <Label htmlFor="reminders-search" className="text-xs">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="reminders-search"
                  placeholder="Search borrower or loan account..."
                  className="w-full pl-8 sm:w-64"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reminders-status" className="text-xs">
                Status
              </Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PaymentReminderStatus | 'ALL')}>
                <SelectTrigger id="reminders-status" className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DateRangeFilter value={dueDateRange} onChange={setDueDateRange} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="sm:ml-auto">
                  <Columns3 className="mr-1.5 h-4 w-4" /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
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
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="loanCode" currentSort={sort} onSort={toggleSort}>
                  Loan Account
                </SortableTableHead>
                <SortableTableHead sortKey="borrowerName" currentSort={sort} onSort={toggleSort}>
                  Borrower
                </SortableTableHead>
                {visibleColumns.dueDate && (
                  <SortableTableHead sortKey="dueDate" currentSort={sort} onSort={toggleSort} isDateColumn>
                    Due Date
                  </SortableTableHead>
                )}
                {visibleColumns.principalDue && (
                  <SortableTableHead sortKey="principalDue" currentSort={sort} onSort={toggleSort} className="text-right">
                    Principal Due
                  </SortableTableHead>
                )}
                {visibleColumns.interestDue && (
                  <SortableTableHead sortKey="interestDue" currentSort={sort} onSort={toggleSort} className="text-right">
                    Interest Due
                  </SortableTableHead>
                )}
                {visibleColumns.penaltyDue && (
                  <SortableTableHead sortKey="penaltyDue" currentSort={sort} onSort={toggleSort} className="text-right">
                    Penalty Due
                  </SortableTableHead>
                )}
                {visibleColumns.feesDue && (
                  <SortableTableHead sortKey="feesDue" currentSort={sort} onSort={toggleSort} className="text-right">
                    Fees Due
                  </SortableTableHead>
                )}
                {visibleColumns.amountDue && (
                  <SortableTableHead sortKey="amountDue" currentSort={sort} onSort={toggleSort} className="text-right">
                    Total Amount Due
                  </SortableTableHead>
                )}
                {visibleColumns.progress && <TableHead>Progress</TableHead>}
                <SortableTableHead sortKey="status" currentSort={sort} onSort={toggleSort}>
                  Status
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((r) => {
                const badge = STATUS_BADGE[r.status];
                const components = remainingDueByComponent(r);
                return (
                  <TableRow key={r.installmentId} className="cursor-pointer" onClick={() => navigate(`/loans/${r.loanAccountId}`)}>
                    <TableCell className="font-mono text-xs">{r.loanCode}</TableCell>
                    <TableCell className="font-medium">{r.borrowerName}</TableCell>
                    {visibleColumns.dueDate && <TableCell className="text-xs text-muted-foreground">{formatDate(r.dueDate)}</TableCell>}
                    {visibleColumns.principalDue && <TableCell className="text-right">{formatPeso(components.principal)}</TableCell>}
                    {visibleColumns.interestDue && <TableCell className="text-right">{formatPeso(components.interest)}</TableCell>}
                    {visibleColumns.penaltyDue && <TableCell className="text-right">{formatPeso(components.penalty)}</TableCell>}
                    {visibleColumns.feesDue && <TableCell className="text-right">{formatPeso(components.fees)}</TableCell>}
                    {visibleColumns.amountDue && (
                      <TableCell className="text-right font-semibold">{formatPeso(remainingDue(r))}</TableCell>
                    )}
                    {visibleColumns.progress && (
                      <TableCell className="text-xs text-muted-foreground">
                        {r.installmentsPaidCount} of {r.installmentsTotalCount} paid
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant={badge.variant}>
                        <span className="flex items-center gap-1">
                          {r.status === 'LATE' ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {badge.label}
                        </span>
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={visibleColumnCount} className="py-10 text-center text-sm text-muted-foreground">
                    {remindersQuery.isLoading ? 'Loading…' : 'No installments match your filter.'}
                  </TableCell>
                </TableRow>
              )}
              {filtered.length > 0 && (
                <TableRow className="border-t-2 bg-muted/40 font-semibold hover:bg-muted/40">
                  <TableCell colSpan={2}>Total ({filtered.length} installment{filtered.length === 1 ? '' : 's'})</TableCell>
                  {visibleColumns.dueDate && <TableCell />}
                  {visibleColumns.principalDue && <TableCell className="text-right">{formatPeso(totals.principal)}</TableCell>}
                  {visibleColumns.interestDue && <TableCell className="text-right">{formatPeso(totals.interest)}</TableCell>}
                  {visibleColumns.penaltyDue && <TableCell className="text-right">{formatPeso(totals.penalty)}</TableCell>}
                  {visibleColumns.feesDue && <TableCell className="text-right">{formatPeso(totals.fees)}</TableCell>}
                  {visibleColumns.amountDue && <TableCell className="text-right">{formatPeso(totals.amountDue)}</TableCell>}
                  {visibleColumns.progress && <TableCell />}
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
          <PaginationControls
            pageNumber={currentPage}
            hasNext={currentPage < pageCount}
            hasPrev={currentPage > 1}
            onNext={() => setPage((p) => p + 1)}
            onPrev={() => setPage((p) => p - 1)}
            pageSize={PAGE_SIZE}
            itemCount={pageRows.length}
          />
        </CardContent>
      </Card>

      <RecentActivityPanel label="Due & Overdue" />
    </div>
  );
}
