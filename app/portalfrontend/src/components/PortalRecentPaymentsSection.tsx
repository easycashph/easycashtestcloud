import * as React from 'react';
import { ReceiptText } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiClient } from '@/lib/apiClient';
import type { PortalPaymentEntry } from '@/lib/portalApiTypes';

function peso(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : value;
}

/**
 * Dashboard "Recent Payments" widget (2026-08-06 user request) - the client's own actual posted
 * payments (real money received, not the schedule), most recent first, across every one of their
 * loan accounts. Renders nothing at all once loaded if there's no payment history yet - same
 * "never a placeholder implying something exists" posture as `PortalLoanAccountsSection`.
 */
export function PortalRecentPaymentsSection() {
  const [payments, setPayments] = React.useState<PortalPaymentEntry[] | null>(null);

  React.useEffect(() => {
    apiClient
      .get<PortalPaymentEntry[]>('/portal/loan-accounts/recent-payments')
      .then(setPayments)
      .catch(() => setPayments([]));
  }, []);

  if (payments !== null && payments.length === 0) return null;

  return (
    <Card className="mt-5 p-6">
      <h2 className="text-base font-semibold">Recent Payments</h2>
      {payments === null ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : (
        <div className="mt-4 divide-y divide-border">
          {payments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                  <ReceiptText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{payment.loanCode}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(payment.entryDate).toLocaleDateString()}
                    {payment.paymentMethod ? ` - ${payment.paymentMethod}` : ''}
                    {payment.orNumber ? ` - OR# ${payment.orNumber}` : ''}
                  </p>
                </div>
              </div>
              <p className="shrink-0 text-sm font-semibold text-success">{peso(payment.amount)}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
