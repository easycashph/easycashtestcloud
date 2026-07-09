/**
 * Mirrors `app/backend`'s `PaymentReminderPresenter.presentPaymentReminder()` JSON shape exactly
 * — see `apiClient.ts`'s doc comment for why this pilot hand-maintains DTOs instead of generating
 * them. One row per active loan account's next not-fully-paid installment — never a full
 * multi-trigger reminder history, since no real notification/scheduling service exists yet.
 */
export interface InstallmentAmountsDto {
  principal: string;
  interest: string;
  fees: string;
  penalty: string;
  total: string;
}

export type PaymentReminderStatus = 'PENDING' | 'PARTIALLY_PAID' | 'LATE';

export interface PaymentReminder {
  installmentId: string;
  loanAccountId: string;
  loanCode: string;
  branchId: string;
  borrowerName: string;
  installmentNumber: number;
  dueDate: string;
  due: InstallmentAmountsDto;
  paid: InstallmentAmountsDto;
  status: PaymentReminderStatus;
  installmentsPaidCount: number;
  installmentsTotalCount: number;
}
