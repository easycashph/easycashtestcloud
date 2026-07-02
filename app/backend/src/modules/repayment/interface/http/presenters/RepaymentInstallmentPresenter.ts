import type { RepaymentInstallment } from '../../../domain/RepaymentInstallment';
import type { InstallmentAmounts } from '../../../domain/valueObjects/InstallmentAmounts';

/** Milestone 8 / D-5: the only place RepaymentInstallment becomes JSON-safe — Money/Date formatting never happens in the controller. */
function presentAmounts(amounts: InstallmentAmounts) {
  return {
    principal: amounts.principal.toString(),
    interest: amounts.interest.toString(),
    fees: amounts.fees.toString(),
    penalty: amounts.penalty.toString(),
    total: amounts.total().toString(),
  };
}

export function presentRepaymentInstallment(installment: RepaymentInstallment) {
  return {
    id: installment.id,
    loanAccountId: installment.loanAccountId,
    installmentNumber: installment.installmentNumber,
    dueDate: installment.dueDate.toISOString(),
    due: presentAmounts(installment.due),
    paid: presentAmounts(installment.paid),
    // Derived (REPAY-3), never independently stored — see RepaymentInstallment.status.
    status: installment.status,
    lastPaidAt: installment.lastPaidAt?.toISOString() ?? null,
    legacyId: installment.legacyId ?? null,
    createdAt: installment.createdAt.toISOString(),
    updatedAt: installment.updatedAt.toISOString(),
  };
}
