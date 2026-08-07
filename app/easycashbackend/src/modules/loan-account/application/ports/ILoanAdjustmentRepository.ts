import type { TransactionContext } from '@shared/application/TransactionContext';
import type { LoanAdjustment } from '../../domain/LoanAdjustment';

/**
 * 2026-07-24 (Loan Adjustment feature) — a read-model shape, not the domain entity, same
 * "view, not entity" posture as `LoanRestructureView`.
 */
export interface LoanAdjustmentView {
  id: string;
  oldLoanAccountId: string;
  oldLoanCode: string;
  newLoanAccountId: string;
  newLoanCode: string;
  previousFirstRepaymentDate: Date;
  newFirstRepaymentDate: Date;
  reason: string | null;
  adjustedByUserId: string;
  adjustedByName: string | null;
  createdAt: Date;
  /** 2026-08-07 (Undo Adjustment feature) — both null unless this adjustment has been undone. */
  undoneAt: Date | null;
  undoneByName: string | null;
}

export interface ILoanAdjustmentRepository {
  /** Immutable rows (see `LoanAdjustment`'s own doc comment) — never updated except via `update()`. */
  create(adjustment: LoanAdjustment, ctx?: TransactionContext): Promise<void>;
  /** Non-null only when `loanAccountId` was the OLD side of a currently-ACTIVE (not undone) adjustment. */
  findByOldLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanAdjustment | null>;
  /** Non-null only when `loanAccountId` was the NEW side of an adjustment. */
  findByNewLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanAdjustment | null>;
  /** 2026-08-07 (Undo Adjustment feature): persists `LoanAdjustment.markUndone()` - the one field this row is ever allowed to change after creation. */
  update(adjustment: LoanAdjustment, ctx?: TransactionContext): Promise<void>;
  /** Display-ready view for either side of an adjustment, whichever `loanAccountId` participated in — used by the Loan Detail page. */
  findViewByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanAdjustmentView | null>;
}
