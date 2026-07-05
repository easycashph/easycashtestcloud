import { Badge } from '@/components/ui/badge';
import type { LoanAccountStatus, RepaymentInstallmentStatus } from '@/lib/mockData';

const LOAN_STATUS_STYLE: Record<LoanAccountStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' }> = {
  PENDING_APPROVAL: { label: 'Pending Approval', variant: 'secondary' },
  APPROVED: { label: 'Approved', variant: 'outline' },
  ACTIVE: { label: 'Active', variant: 'success' },
  ACTIVE_IN_ARREARS: { label: 'In Arrears', variant: 'destructive' },
  CLOSED: { label: 'Closed', variant: 'secondary' },
  CLOSED_WRITTEN_OFF: { label: 'Written Off', variant: 'destructive' },
  CLOSED_REJECTED: { label: 'Rejected', variant: 'secondary' },
};

export function LoanStatusBadge({ status }: { status: LoanAccountStatus }) {
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
