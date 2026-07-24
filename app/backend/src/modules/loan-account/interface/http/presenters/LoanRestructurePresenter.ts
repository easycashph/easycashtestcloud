import type { LoanRestructureView } from '../../../application/ports/ILoanRestructureRepository';

/** 2026-07-24 (Loan Restructure feature) — the only place `LoanRestructureView` becomes JSON-safe. */
export function presentLoanRestructure(view: LoanRestructureView) {
  return {
    id: view.id,
    oldLoanAccountId: view.oldLoanAccountId,
    oldLoanCode: view.oldLoanCode,
    newLoanAccountId: view.newLoanAccountId,
    newLoanCode: view.newLoanCode,
    previousCollectionsBalance: view.previousCollectionsBalance.toString(),
    newPrincipalAmount: view.newPrincipalAmount.toString(),
    reason: view.reason,
    restructuredByUserId: view.restructuredByUserId,
    restructuredByName: view.restructuredByName,
    createdAt: view.createdAt.toISOString(),
  };
}
