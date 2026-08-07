import type { Money } from '@shared/domain/Money';
import type { TransactionContext } from '@shared/application/TransactionContext';
import type { LoanRestructure } from '../../domain/LoanRestructure';

/**
 * 2026-07-24 (Loan Restructure feature) — a read-model shape, not the domain entity, same "view,
 * not entity" posture as `PenaltyReductionView`: carries display-join context (loan codes, the
 * staff member's name) the aggregate itself deliberately doesn't.
 */
export interface LoanRestructureView {
  id: string;
  oldLoanAccountId: string;
  oldLoanCode: string;
  newLoanAccountId: string;
  newLoanCode: string;
  previousCollectionsBalance: Money;
  newPrincipalAmount: Money;
  reason: string | null;
  restructuredByUserId: string;
  restructuredByName: string | null;
  createdAt: Date;
  /** 2026-08-07 (Undo Restructure feature) — both null unless this restructure has been undone. */
  undoneAt: Date | null;
  undoneByName: string | null;
}

export interface ILoanRestructureRepository {
  /** Immutable rows (see `LoanRestructure`'s own doc comment) — never updated except via `update()`. */
  create(restructure: LoanRestructure, ctx?: TransactionContext): Promise<void>;
  /** Non-null only when `loanAccountId` was the OLD side of a currently-ACTIVE (not undone) restructure. */
  findByOldLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanRestructure | null>;
  /** Non-null only when `loanAccountId` was the NEW side of a restructure. */
  findByNewLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanRestructure | null>;
  /** 2026-08-07 (Undo Restructure feature): persists `LoanRestructure.markUndone()` - the one field this row is ever allowed to change after creation. */
  update(restructure: LoanRestructure, ctx?: TransactionContext): Promise<void>;
  /** Display-ready view for either side of a restructure, whichever `loanAccountId` participated in — used by the Loan Detail page. */
  findViewByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanRestructureView | null>;
}
