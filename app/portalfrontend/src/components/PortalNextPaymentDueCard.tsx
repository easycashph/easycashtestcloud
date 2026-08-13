import * as React from 'react';
import { CalendarClock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { apiClient } from '@/lib/apiClient';
import type { PortalNextPaymentDue } from '@/lib/portalApiTypes';

function peso(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : value;
}

function daysUntil(dueDate: string): number {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Dashboard "Next Payment Due" reminder (2026-08-06 user request) - the soonest unpaid installment
 * across every one of the client's open loan accounts, surfaced at a glance instead of buried
 * inside each loan's own payment schedule. Renders nothing at all once loaded if there's genuinely
 * nothing upcoming (no open loan, or everything already paid) - same "never a placeholder implying
 * something exists" posture as `PortalLoanAccountsSection`.
 */
export function PortalNextPaymentDueCard() {
  const [nextPaymentDue, setNextPaymentDue] = React.useState<PortalNextPaymentDue | null | undefined>(undefined);

  React.useEffect(() => {
    apiClient
      .get<PortalNextPaymentDue | null>('/portal/loan-accounts/next-payment-due')
      .then(setNextPaymentDue)
      .catch(() => setNextPaymentDue(null));
  }, []);

  if (!nextPaymentDue) return null;

  const remainingDue = Number(nextPaymentDue.totalDue) - Number(nextPaymentDue.totalPaid);
  const days = daysUntil(nextPaymentDue.dueDate);
  const isOverdue = nextPaymentDue.status === 'LATE' || days < 0;
  const dueLabel = isOverdue
    ? days < 0
      ? `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
      : 'Past due'
    : days === 0
      ? 'Due today'
      : days === 1
        ? 'Due tomorrow'
        : `Due in ${days} days`;

  return (
    <Card className={`flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between ${isOverdue ? 'border-destructive/40 bg-destructive/5' : 'border-primary/30 bg-primary/5'}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isOverdue ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'}`}>
          <CalendarClock className="h-5 w-5" />
        </div>
        <div>
          <p className={`text-sm font-semibold ${isOverdue ? 'text-destructive' : 'text-foreground'}`}>Next Payment Due - {dueLabel}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {peso(remainingDue.toString())} for {nextPaymentDue.loanCode}, installment #{nextPaymentDue.installmentNumber} - due{' '}
            {new Date(nextPaymentDue.dueDate).toLocaleDateString()}
          </p>
        </div>
      </div>
    </Card>
  );
}
