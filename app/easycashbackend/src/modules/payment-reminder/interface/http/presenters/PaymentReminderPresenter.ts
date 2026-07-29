import type { PaymentReminderCandidate } from '../../../application/ports/IPaymentReminderRepository';

export interface PaymentReminderResponse {
  installmentId: string;
  loanAccountId: string;
  loanCode: string;
  branchId: string;
  borrowerName: string;
  installmentNumber: number;
  dueDate: string;
  due: PaymentReminderCandidate['due'];
  paid: PaymentReminderCandidate['paid'];
  status: PaymentReminderCandidate['status'];
  installmentsPaidCount: number;
  installmentsTotalCount: number;
}

export function presentPaymentReminder(candidate: PaymentReminderCandidate): PaymentReminderResponse {
  return {
    installmentId: candidate.installmentId,
    loanAccountId: candidate.loanAccountId,
    loanCode: candidate.loanCode,
    branchId: candidate.branchId,
    borrowerName: candidate.borrowerName,
    installmentNumber: candidate.installmentNumber,
    dueDate: candidate.dueDate.toISOString(),
    due: candidate.due,
    paid: candidate.paid,
    status: candidate.status,
    installmentsPaidCount: candidate.installmentsPaidCount,
    installmentsTotalCount: candidate.installmentsTotalCount,
  };
}
