import type { LoanCompromiseSettlementView } from '../../../application/ports/ILoanCompromiseSettlementRepository';

/** 2026-08-29 (Compromise Settlement feature) — the only place `LoanCompromiseSettlementView` becomes JSON-safe. */
export function presentLoanCompromiseSettlement(view: LoanCompromiseSettlementView) {
  return {
    id: view.id,
    newLoanAccountId: view.newLoanAccountId,
    newLoanCode: view.newLoanCode,
    totalPreviousBalance: view.totalPreviousBalance.toString(),
    settlementAmount: view.settlementAmount.toString(),
    reason: view.reason,
    settledByUserId: view.settledByUserId,
    settledByName: view.settledByName,
    createdAt: view.createdAt.toISOString(),
    items: view.items.map((item) => ({
      id: item.id,
      oldLoanAccountId: item.oldLoanAccountId,
      oldLoanCode: item.oldLoanCode,
      previousCollectionsBalance: item.previousCollectionsBalance.toString(),
    })),
  };
}
