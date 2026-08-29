import { Badge } from '@/components/ui/badge';
import type { LoanAccountStatus, RepaymentInstallmentStatus } from '@/lib/loanApiTypes';

const LOAN_STATUS_STYLE: Record<LoanAccountStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' }> = {
  PENDING_APPROVAL: { label: 'Pending Approval', variant: 'secondary' },
  APPROVED: { label: 'For Disbursement', variant: 'success' },
  ACTIVE: { label: 'Active', variant: 'success' },
  ACTIVE_IN_ARREARS: { label: 'In Arrears', variant: 'warning' },
  CLOSED: { label: 'Closed', variant: 'success' },
  CLOSED_WRITTEN_OFF: { label: 'Written Off', variant: 'destructive' },
  CLOSED_REJECTED: { label: 'Rejected', variant: 'secondary' },
  CLOSED_RESTRUCTURED: { label: 'Restructured', variant: 'secondary' },
  CLOSED_ADJUSTED: { label: 'Rescheduled', variant: 'secondary' },
  CLOSED_COMPROMISED: { label: 'Compromised', variant: 'secondary' },
  CLOSED_UNDONE: { label: 'Undone', variant: 'secondary' },
};

/**
 * `isMatured` (2026-07-13) - not a `LoanAccountStatus` enum value (the real backend has never
 * had a `MATURED` status - see `docs/Architecture/CP12-*.md` history), but a server-computed
 * overlay: per Investopedia's definition, the loan's full scheduled term has ended and it's
 * still unpaid, distinct from "in arrears" (still mid-term, missed a payment). Takes priority
 * over the raw `status` label/color when true - red (`destructive`), never green/`success`,
 * since an unpaid matured loan is higher-risk than one still mid-term and merely late.
 */
export function LoanStatusBadge({ status, isMatured }: { status: LoanAccountStatus; isMatured?: boolean }) {
  if (isMatured) {
    return <Badge variant="destructive">Matured</Badge>;
  }
  const config = LOAN_STATUS_STYLE[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

const INSTALLMENT_STATUS_STYLE: Record<RepaymentInstallmentStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }> = {
  PENDING: { label: 'Pending', variant: 'secondary' },
  PARTIALLY_PAID: { label: 'Partially Paid', variant: 'warning' },
  PAID: { label: 'Paid', variant: 'success' },
  LATE: { label: 'Late', variant: 'destructive' },
};

export function InstallmentStatusBadge({ status }: { status: RepaymentInstallmentStatus }) {
  const config = INSTALLMENT_STATUS_STYLE[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
