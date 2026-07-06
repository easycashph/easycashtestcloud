import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { DateRangeFilter, type DateRange } from '@/components/DateRangeFilter';
import { PaymentMethodBadge } from '@/components/PaymentMethodBadge';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useSortableTable } from '@/lib/useSortableTable';
import {
  MOCK_ACTIVITY_LOGS,
  MOCK_TRANSACTIONS,
  REPORT_BRANCHES,
  REPORT_PAYMENT_METHODS,
  REPORT_TRANSACTION_TYPES,
  type LoanTransactionType,
  type MockLoanTransaction,
} from '@/lib/mockData';
import { formatDate, formatPeso } from '@/lib/utils';

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function getSortValue(txn: MockLoanTransaction, key: string): string | number | Date | null | undefined {
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
    case 'paymentMethod':
      return txn.paymentMethod ?? '';
    case 'amount':
      return txn.amount;
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
  ADJUSTMENT: 'warning',
  REVERSAL: 'destructive',
};

export function TransactionReportPage() {
  useLogPageView('Transaction Report');
  const [range, setRange] = React.useState<DateRange>(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 90 * 86_400_000);
    return { from: isoDate(from), to: isoDate(to) };
  });
  const [type, setType] = React.useState<LoanTransactionType | 'ALL'>('ALL');
  const [branchId, setBranchId] = React.useState<string>('ALL');
  const [paymentMethod, setPaymentMethod] = React.useState<string>('ALL');
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = MOCK_TRANSACTIONS.filter((txn) => {
    const day = txn.entryDate.slice(0, 10);
    const matchesRange = (!range.from || day >= range.from) && (!range.to || day <= range.to);
    const matchesType = type === 'ALL' || txn.type === type;
    const matchesBranch = branchId === 'ALL' || txn.branchId === branchId;
    const matchesPaymentMethod = paymentMethod === 'ALL' || txn.paymentMethod === paymentMethod;
    return matchesRange && matchesType && matchesBranch && matchesPaymentMethod;
  });
  const { sorted, sort, toggleSort } = useSortableTable(filtered, getSortValue, { key: 'entryDate', direction: 'desc' });

  const total = filtered.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Transaction Report</h2>
        <p className="text-sm text-muted-foreground">
          {MOCK_TRANSACTIONS.length} sample ledger entries. Click a row to expand its component breakdown.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Date range, transaction type, and branch — all filter the table below client-side.</CardDescription>
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
                {REPORT_TRANSACTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replaceAll('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All branches</SelectItem>
                {REPORT_BRANCHES.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All modes of payment</SelectItem>
                {REPORT_PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.code} value={m.code}>
                    {m.label}
                    {!m.isActive ? ' (Discontinued)' : ''}
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
                <SortableTableHead sortKey="paymentMethod" currentSort={sort} onSort={toggleSort}>
                  Mode of Payment
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
                      <TableCell>{txn.paymentMethod ? <PaymentMethodBadge code={txn.paymentMethod} /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right">{formatPeso(txn.amount)}</TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-secondary/30">
                          <div className="grid grid-cols-4 gap-4 p-2 text-sm">
                            <div>
                              <p className="text-xs uppercase text-muted-foreground">Principal</p>
                              <p className="font-medium">{formatPeso(txn.components.principal)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase text-muted-foreground">Interest</p>
                              <p className="font-medium">{formatPeso(txn.components.interest)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase text-muted-foreground">Fees</p>
                              <p className="font-medium">{formatPeso(txn.components.fees)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase text-muted-foreground">Penalty</p>
                              <p className="font-medium">{formatPeso(txn.components.penalty)}</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No sample transactions match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={7}>Total ({filtered.length} entries)</TableCell>
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
