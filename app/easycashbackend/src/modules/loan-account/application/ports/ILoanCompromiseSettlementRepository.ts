import type { Money } from '@shared/domain/Money';
import type { TransactionContext } from '@shared/application/TransactionContext';
import type { LoanCompromiseSettlement } from '../../domain/LoanCompromiseSettlement';

/** 2026-08-29 (Compromise Settlement feature) — a read-model shape, not the domain entity, same
 * "view, not entity" posture as `LoanRestructureView`. One item per old loan folded in. */
export interface LoanCompromiseSettlementItemView {
  id: string;
  oldLoanAccountId: string;
  oldLoanCode: string;
  previousCollectionsBalance: Money;
}

export interface LoanCompromiseSettlementView {
  id: string;
  newLoanAccountId: string;
  newLoanCode: string;
  totalPreviousBalance: Money;
  settlementAmount: Money;
  reason: string | null;
  settledByUserId: string;
  settledByName: string | null;
  createdAt: Date;
  items: LoanCompromiseSettlementItemView[];
}

export interface ILoanCompromiseSettlementRepository {
  /** Immutable rows (see `LoanCompromiseSettlement`'s own doc comment) — never updated, only created. */
  create(settlement: LoanCompromiseSettlement, ctx?: TransactionContext): Promise<void>;
  /** Non-null only when `loanAccountId` was one of the OLD loans folded into a settlement. */
  findByOldLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanCompromiseSettlement | null>;
  /** Non-null only when `loanAccountId` was the NEW (consolidated) side of a settlement. */
  findByNewLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanCompromiseSettlement | null>;
  /** Display-ready view for either side of a settlement, whichever `loanAccountId` participated in — used by the Loan Detail page. */
  findViewByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanCompromiseSettlementView | null>;
}
