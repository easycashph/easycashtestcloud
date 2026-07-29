import type { InstallmentAdjustment } from '../../../application/use-cases/ListInstallmentAdjustmentsForLoanUseCase';

/** Milestone 8 / D-5 — the only place InstallmentAdjustment becomes JSON-safe. Flattens the tagged union into one shape the frontend can render generically, distinguishing the two kinds by `kind` and `previousAmount`/`newAmount` (component-agnostic names, since a penalty reduction and a fee adjustment aren't the same due component). */
export function presentInstallmentAdjustment(adjustment: InstallmentAdjustment) {
  const { kind, view } = adjustment;
  if (kind === 'PENALTY_REDUCTION') {
    return {
      kind,
      id: view.id,
      repaymentInstallmentId: view.repaymentInstallmentId,
      installmentNumber: view.installmentNumber,
      installmentDueDate: view.installmentDueDate.toISOString(),
      previousAmount: view.previousPenaltyAmount.toString(),
      newAmount: view.newPenaltyAmount.toString(),
      reason: view.reason,
      byUserId: view.reducedByUserId,
      byName: view.reducedByName,
      at: view.createdAt.toISOString(),
    };
  }
  return {
    kind,
    id: view.id,
    repaymentInstallmentId: view.repaymentInstallmentId,
    installmentNumber: view.installmentNumber,
    installmentDueDate: view.installmentDueDate.toISOString(),
    previousAmount: view.previousFeesAmount.toString(),
    newAmount: view.newFeesAmount.toString(),
    reason: view.reason,
    byUserId: view.adjustedByUserId,
    byName: view.adjustedByName,
    at: view.createdAt.toISOString(),
  };
}
