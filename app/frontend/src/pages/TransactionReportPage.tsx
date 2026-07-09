import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { DateRangeFilter, type DateRange } from '@/components/DateRangeFilter';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useSortableTable } from '@/lib/useSortableTable';
import { fetchAllPages } from '@/lib/apiClient';
import type { LoanTransactionType, TransactionReportRow } from '@/lib/reportApiTypes';
import { MOCK_ACTIVITY_LOGS } from '@/lib/mockData';
import { formatDate, formatPeso } from '@/lib/utils';

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

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

/**
 * Wired to the real backend (`GET /reports/transactions`). Drops the mock version's "Mode of
 * Payment" filter/column: `LoanTransaction` has no payment-method field in the schema — showing
 * one would be fabricated. Branch scoping is automatic from the signed-in session, matching
 * Dashboard/Payment Reminders, rather than a manual branch picker.
 */
export function TransactionReportPage() {
  useLogPageView('Transaction Report');
  const [range, setRange] = React.useState<DateRange>(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 90 * 86_400_000);
    return { from: isoDate(from), to: isoDate(to) };
  });
  const [type, setType] = React.useState<LoanTransactionType | 'ALL'>('ALL');
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Transaction Report</h2>
        <p className="text-sm text-muted-foreground">
          {transactions.length} ledger entr{transactions.length === 1 ? 'y' : 'ies'}. Click a row to expand its component breakdown.
        </p>
      </div>

      {transactionsQuery.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Could not load the transaction report. Is the backend running?
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
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <SortableTableHead sortKey="entryDate" currentSort={sort} onSort={toggleSort} isDateColumn>
                  Date
                </SortableTableHead>
                <SortableTableHead sortKey="loanCode" currentSort={sort} onSort={toggleSort}>
                  Loan Code
                </SortableTableHead>
                <SortableTableHead sortKey="borrowerName" currentSort={sort} onSort={toggleSort}>
                  Borrower
                </SortableTableHead>
                <SortableTableHead sortKey="type" currentSort={sort} onSort={toggleSort}>
                  Type
                </SortableTableHead>
                <SortableTableHead sortKey="branchName" currentSort={sort} onSort={toggleSort}>
                  Branch
                </SortableTableHead>
                <SortableTableHead sortKey="amount" currentSort={sort} onSort={toggleSort} className="text-right">
                  Amount
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((txn) => {
                const isOpen = expanded.has(txn.id);
                return (
                  <React.Fragment key={txn.id}>
                    <TableRow className="cursor-pointer" onClick={() => toggle(txn.id)}>
                      <TableCell>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                      <TableCell>{formatDate(txn.entryDate)}</TableCell>
                      <TableCell className="font-mono text-xs">{txn.loanCode}</TableCell>
                      <TableCell>{txn.borrowerName}</TableCell>
                      <TableCell>
                        <Badge variant={TYPE_BADGE_VARIANT[txn.type]}>{txn.type.replaceAll('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{txn.branchName}</TableCell>
                      <TableCell className="text-right">{formatPeso(Number(txn.amount))}</TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-secondary/30">
                          <div className="grid grid-cols-4 gap-4 p-2 text-sm">
                            <div>
                              <p className="text-xs uppercase text-muted-foreground">Principal</p>
                              <p className="font-medium">{formatPeso(Number(txn.components.principal))}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase text-muted-foreground">Interest</p>
                              <p className="font-medium">{formatPeso(Number(txn.components.interest))}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase text-muted-foreground">Fees</p>
                              <p className="font-medium">{formatPeso(Number(txn.components.fees))}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase text-muted-foreground">Penalty</p>
                              <p className="font-medium">{formatPeso(Number(txn.components.penalty))}</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    {transactionsQuery.isLoading ? 'Loading…' : 'No transactions match these filters.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={6}>Total ({transactions.length} entries)</TableCell>
                <TableCell className="text-right">{formatPeso(total)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <RecentActivityPanel entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'Transaction Report')} title="Recent Activity — Transaction Report" />
    </div>
  );
}
