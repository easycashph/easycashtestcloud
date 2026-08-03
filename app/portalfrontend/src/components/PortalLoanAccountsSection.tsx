import * as React from 'react';
import { Landmark } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiClient } from '@/lib/apiClient';
import type { PortalInstallmentEntry, PortalLoanAccountSummary } from '@/lib/portalApiTypes';

function peso(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : value;
}

const INSTALLMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Not yet due',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  LATE: 'Overdue',
};

const INSTALLMENT_STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-secondary text-secondary-foreground',
  PARTIALLY_PAID: 'bg-warning/15 text-warning',
  PAID: 'bg-success/15 text-success',
  LATE: 'bg-destructive/15 text-destructive',
};

function InstallmentScheduleDialog({ loanAccount, onClose }: { loanAccount: PortalLoanAccountSummary | null; onClose: () => void }) {
  const [installments, setInstallments] = React.useState<PortalInstallmentEntry[] | null>(null);

  React.useEffect(() => {
    if (!loanAccount) return;
    setInstallments(null);
    apiClient
      .get<PortalInstallmentEntry[]>(`/portal/loan-accounts/${loanAccount.id}/installments`)
      .then(setInstallments)
      .catch(() => setInstallments([]));
  }, [loanAccount]);

  return (
    <Dialog open={loanAccount !== null} onClose={onClose} title={loanAccount ? `Payment Schedule - ${loanAccount.loanCode}` : 'Payment Schedule'}>
      {installments === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : installments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No installment schedule found for this loan.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">Due Date</th>
                  <th className="py-2 pr-3 font-medium">Amount Due</th>
                  <th className="py-2 pr-3 font-medium">Paid</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((installment) => (
                  <tr key={installment.installmentNumber} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3">{installment.installmentNumber}</td>
                    <td className="py-2 pr-3">{new Date(installment.dueDate).toLocaleDateString()}</td>
                    <td className="py-2 pr-3">{peso(installment.totalDue)}</td>
                    <td className="py-2 pr-3">{peso(installment.totalPaid)}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${INSTALLMENT_STATUS_TONE[installment.status] ?? 'bg-secondary'}`}>
                        {INSTALLMENT_STATUS_LABELS[installment.status] ?? installment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Browser-native print (Ctrl/Cmd+P -> Save as PDF) - a real, always-accurate way to get a
              downloadable copy without generating/storing a separate PDF that could drift from the
              live schedule above. */}
          <Button type="button" variant="outline" className="mt-4" onClick={() => window.print()}>
            Print / Save as PDF
          </Button>
        </>
      )}
    </Dialog>
  );
}

/** "My Loans" section on the Portal dashboard (2026-07-31 user request, "top reputable lending
 * site" checklist) - payment history and a printable amortization schedule for a client's real,
 * booked loan account(s). Renders nothing at all once loaded if the account has none yet (still
 * pre-approval/under review, or not yet linked) - never a placeholder/empty-state card implying a
 * loan exists. */
export function PortalLoanAccountsSection() {
  const [loanAccounts, setLoanAccounts] = React.useState<PortalLoanAccountSummary[] | null>(null);
  const [viewingLoanAccount, setViewingLoanAccount] = React.useState<PortalLoanAccountSummary | null>(null);

  React.useEffect(() => {
    apiClient
      .get<PortalLoanAccountSummary[]>('/portal/loan-accounts')
      .then(setLoanAccounts)
      .catch(() => setLoanAccounts([]));
  }, []);

  if (loanAccounts !== null && loanAccounts.length === 0) return null;

  return (
    <>
      <Card className="mt-5 p-6">
        <h2 className="text-base font-semibold">My Loans</h2>
        {loanAccounts === null ? (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="mt-4 divide-y divide-border">
            {loanAccounts.map((loanAccount) => (
              <div key={loanAccount.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Landmark className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{loanAccount.loanCode}</p>
                    <p className="text-xs text-muted-foreground">
                      Outstanding balance: {peso(loanAccount.outstandingBalance)} of {peso(loanAccount.principalAmount)}
                    </p>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setViewingLoanAccount(loanAccount)}>
                  View Payment Schedule
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <InstallmentScheduleDialog loanAccount={viewingLoanAccount} onClose={() => setViewingLoanAccount(null)} />
    </>
  );
}
