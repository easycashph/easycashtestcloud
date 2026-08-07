import type { LoanAdjustmentView } from '../../../application/ports/ILoanAdjustmentRepository';

/** 2026-07-24 (Loan Adjustment feature) — the only place `LoanAdjustmentView` becomes JSON-safe. */
export function presentLoanAdjustment(view: LoanAdjustmentView) {
  return {
    id: view.id,
    oldLoanAccountId: view.oldLoanAccountId,
    oldLoanCode: view.oldLoanCode,
    newLoanAccountId: view.newLoanAccountId,
    newLoanCode: view.newLoanCode,
    previousFirstRepaymentDate: view.previousFirstRepaymentDate.toISOString(),
    newFirstRepaymentDate: view.newFirstRepaymentDate.toISOString(),
    reason: view.reason,
    adjustedByUserId: view.adjustedByUserId,
    adjustedByName: view.adjustedByName,
    createdAt: view.createdAt.toISOString(),
    undoneAt: view.undoneAt ? view.undoneAt.toISOString() : null,
    undoneByName: view.undoneByName,
  };
}
