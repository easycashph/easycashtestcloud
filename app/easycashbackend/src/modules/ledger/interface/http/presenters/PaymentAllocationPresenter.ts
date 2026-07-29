import type { AllocationWithInstallment } from '../../../application/use-cases/ListPaymentAllocationsForTransactionUseCase';

/** D-5: the only place PaymentAllocation becomes JSON-safe — Money/Date formatting never happens in the controller. */
export function presentPaymentAllocation(item: AllocationWithInstallment) {
  return {
    id: item.allocation.id,
    loanTransactionId: item.allocation.loanTransactionId,
    repaymentInstallmentId: item.allocation.repaymentInstallmentId,
    installmentNumber: item.installmentNumber,
    installmentDueDate: item.installmentDueDate?.toISOString() ?? null,
    principalApplied: item.allocation.principalApplied.toString(),
    interestApplied: item.allocation.interestApplied.toString(),
    feesApplied: item.allocation.feesApplied.toString(),
    penaltyApplied: item.allocation.penaltyApplied.toString(),
  };
}
