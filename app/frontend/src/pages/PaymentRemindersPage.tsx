import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, Clock, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PaginationControls } from '@/components/PaginationControls';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useSortableTable } from '@/lib/useSortableTable';
import { apiClient } from '@/lib/apiClient';
import type { PaymentReminder, PaymentReminderStatus } from '@/lib/paymentReminderApiTypes';
import { MOCK_ACTIVITY_LOGS } from '@/lib/mockData';
import { formatDate, formatPeso } from '@/lib/utils';

function remainingDue(r: PaymentReminder): number {
  return Number(r.due.total) - Number(r.paid.total);
}

function getSortValue(r: PaymentReminder, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'loanCode':
      return r.loanCode;
    case 'borrowerName':
      return r.borrowerName;
    case 'dueDate':
      return new Date(r.dueDate);
    case 'amountDue':
      return remainingDue(r);
    case 'status':
      return r.status;
    default:
      return undefined;
  }
}

const PAGE_SIZE = 100;

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
 * Wired to the real backend (`GET /payment-reminders`) — one row per active loan account's next
 * not-fully-paid installment. There's no notification/scheduling service in this build yet (no
 * SMS/email actually goes out), so this is an "Upcoming & Overdue Installments" worklist, not a
 * simulated reminder-send history like the earlier mock version.
 */
export function PaymentRemindersPage() {
  useLogPageView('Payment Reminders');
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<PaymentReminderStatus | 'ALL'>('ALL');
  const [page, setPage] = React.useState(1);

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
    return matchesSearch && matchesStatus;
  });
  const { sorted, sort, toggleSort } = useSortableTable(filtered, getSortValue, { key: 'dueDate', direction: 'desc' });

  React.useEffect(() => {
    setPage(1);
  }, [search, status]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const overdueCount = reminders.filter((r) => r.status === 'LATE').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Payment Reminders</h2>
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
          <div className="flex flex-col flex-wrap gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search borrower or loan account..."
                className="w-full pl-8 sm:w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as PaymentReminderStatus | 'ALL')}>
              <SelectTrigger className="w-full sm:w-48">
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
                <SortableTableHead sortKey="dueDate" currentSort={sort} onSort={toggleSort} isDateColumn>
                  Due Date
                </SortableTableHead>
                <SortableTableHead sortKey="amountDue" currentSort={sort} onSort={toggleSort} className="text-right">
                  Amount Due
                </SortableTableHead>
                <TableHead>Progress</TableHead>
                <SortableTableHead sortKey="status" currentSort={sort} onSort={toggleSort}>
                  Status
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((r) => {
                const badge = STATUS_BADGE[r.status];
                return (
                  <TableRow key={r.installmentId} className="cursor-pointer" onClick={() => navigate(`/loans/${r.loanAccountId}`)}>
                    <TableCell className="font-mono text-xs">{r.loanCode}</TableCell>
                    <TableCell className="font-medium">{r.borrowerName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(r.dueDate)}</TableCell>
                    <TableCell className="text-right">{formatPeso(remainingDue(r))}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.installmentsPaidCount} of {r.installmentsTotalCount} paid
                    </TableCell>
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
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    {remindersQuery.isLoading ? 'Loading…' : 'No installments match your filter.'}
                  </TableCell>
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
            itemCount={paged.length}
          />
        </CardContent>
      </Card>

      <RecentActivityPanel entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'Payment Reminders')} title="Recent Activity — Payment Reminders" />
    </div>
  );
}
