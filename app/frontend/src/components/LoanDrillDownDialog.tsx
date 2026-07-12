import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoanStatusBadge } from '@/components/StatusBadge';
import type { LoanAccountStatus } from '@/lib/mockData';
import { formatPeso } from '@/lib/utils';

/** Minimal shape every drill-down source (real, backend-derived loan rows) must provide - deliberately not `MockLoanAccount`, since this dialog only ever renders these 6 fields. */
export interface DrillDownLoan {
  id: string;
  loanCode: string;
  borrowerName: string;
  productType: string;
  status: LoanAccountStatus;
  collectionsBalance: number;
}

export interface LoanDrillDown {
  title: string;
  description?: string;
  loans: DrillDownLoan[];
}

/**
 * Shared drill-down for every clickable chart/graph segment on the Dashboard:
 * clicking a Venn region, pie slice, bar, or metric opens this dialog listing
 * exactly which loan accounts make up that analytics figure, each linking to
 * its full Loan Account detail page.
 */
export function LoanDrillDownDialog({ drillDown, onClose }: { drillDown: LoanDrillDown | null; onClose: () => void }) {
  return (
    <Dialog open={drillDown !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{drillDown?.title}</DialogTitle>
          {drillDown?.description && <DialogDescription>{drillDown.description}</DialogDescription>}
        </DialogHeader>
        {drillDown && drillDown.loans.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No loan accounts fall under this segment.</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Code</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Collections Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillDown?.loans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell>
                      <Link to={`/loans/${loan.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                        {loan.loanCode}
                      </Link>
                    </TableCell>
                    <TableCell>{loan.borrowerName}</TableCell>
                    <TableCell className="text-muted-foreground">{loan.productType}</TableCell>
                    <TableCell>
                      <LoanStatusBadge status={loan.status} />
                    </TableCell>
                    <TableCell className="text-right">{formatPeso(loan.collectionsBalance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
