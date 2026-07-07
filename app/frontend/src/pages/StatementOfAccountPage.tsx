import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { ComingSoonButton } from '@/components/ComingSoonButton';
import { InstallmentStatusBadge } from '@/components/StatusBadge';
import { useSortableTable } from '@/lib/useSortableTable';
import { getMockLoan, MOCK_INSTALLMENTS, type MockRepaymentInstallment } from '@/lib/mockData';
import { formatDate, formatPeso } from '@/lib/utils';

function getSortValue(inst: MockRepaymentInstallment, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'installmentNumber':
      return inst.installmentNumber;
    case 'dueDate':
      return new Date(inst.dueDate);
    case 'principalDue':
      return inst.due.principal;
    case 'interestDue':
      return inst.due.interest;
    case 'totalPaid':
      return inst.paid.principal + inst.paid.interest;
    case 'status':
      return inst.status;
    default:
      return undefined;
  }
}

/**
 * `window.print()` is a genuine, working browser feature — no backend
 * needed — so "Print" is left real. Actual file export (PDF/CSV) would
 * require either a backend endpoint or a heavy client-side PDF library,
 * neither in scope for this preview, so "Export PDF" stays a disabled
 * Coming Soon control per this checkpoint's instructions.
 */
export function StatementOfAccountPage() {
  const { loanId } = useParams<{ loanId: string }>();
  const navigate = useNavigate();
  const loan = loanId ? getMockLoan(loanId) : undefined;

  // Computed unconditionally, before the early return below, so
  // useSortableTable's hook call is never skipped on some renders.
  const installments = MOCK_INSTALLMENTS[loan?.id ?? ''] ?? [];
  const { sorted, sort, toggleSort } = useSortableTable(installments, getSortValue, { key: 'dueDate', direction: 'desc' });

  if (!loan) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Sample loan not found: {loanId}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <ComingSoonButton>Export PDF</ComingSoonButton>
        </div>
      </div>

      <Card className="print:border-none print:shadow-none">
        <CardHeader className="items-center border-b text-center">
          <img src="/logo-easycash.png" alt="Easycash logo" className="h-14 w-14 object-contain" />
          <CardTitle>Easycash Lending Company Inc.</CardTitle>
          <p className="text-sm text-muted-foreground">Statement of Account</p>
          <Badge variant="warning">Preview Mode — Sample Data</Badge>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Borrower</p>
              <p className="font-medium">{loan.borrowerName}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Loan Code</p>
              <p className="font-mono font-medium">{loan.loanCode}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Product</p>
              <p className="font-medium">{loan.productType}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Branch</p>
              <p className="font-medium">{loan.branchName}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Statement Date</p>
              <p className="font-medium">{formatDate(new Date())}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Loan Officer</p>
              <p className="font-medium">{loan.loanOfficerName}</p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border bg-secondary/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Collections Balance</p>
              <p className="text-xl font-bold">{formatPeso(loan.collectionsBalance)}</p>
              <p className="text-xs text-muted-foreground">Principal + Interest + Fees + Penalty (ADR-007 §3)</p>
            </div>
            <div className="rounded-md border bg-secondary/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Accounting Balance</p>
              <p className="text-xl font-bold">{formatPeso(loan.accountingBalance)}</p>
              <p className="text-xs text-muted-foreground">Penalty excluded (ADR-007 §3)</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Repayment Schedule</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead sortKey="installmentNumber" currentSort={sort} onSort={toggleSort}>
                    #
                  </SortableTableHead>
                  <SortableTableHead sortKey="dueDate" currentSort={sort} onSort={toggleSort} isDateColumn>
                    Due Date
                  </SortableTableHead>
                  <SortableTableHead sortKey="principalDue" currentSort={sort} onSort={toggleSort} className="text-right">
                    Principal Due
                  </SortableTableHead>
                  <SortableTableHead sortKey="interestDue" currentSort={sort} onSort={toggleSort} className="text-right">
                    Interest Due
                  </SortableTableHead>
                  <SortableTableHead sortKey="totalPaid" currentSort={sort} onSort={toggleSort} className="text-right">
                    Total Paid
                  </SortableTableHead>
                  <SortableTableHead sortKey="status" currentSort={sort} onSort={toggleSort}>
                    Status
                  </SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((inst) => (
                  <TableRow key={inst.id}>
                    <TableCell>{inst.installmentNumber}</TableCell>
                    <TableCell>{formatDate(inst.dueDate)}</TableCell>
                    <TableCell className="text-right">{formatPeso(inst.due.principal)}</TableCell>
                    <TableCell className="text-right">{formatPeso(inst.due.interest)}</TableCell>
                    <TableCell className="text-right">{formatPeso(inst.paid.principal + inst.paid.interest)}</TableCell>
                    <TableCell>
                      <InstallmentStatusBadge status={inst.status} />
                    </TableCell>
                  </TableRow>
                ))}
                {installments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                      No schedule yet — loan has not been activated.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            This is a sample statement generated for internal UI preview purposes only. Figures are fabricated and do not represent an
            official financial document.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
