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
}

export interface ILoanAdjustmentRepository {
  /** Immutable rows (see `LoanAdjustment`'s own doc comment) — never updated. */
  create(adjustment: LoanAdjustment, ctx?: TransactionContext): Promise<void>;
  /** Non-null only when `loanAccountId` was the OLD side of an adjustment (enforces the one-time-only rule). */
  findByOldLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanAdjustment | null>;
  /** Non-null only when `loanAccountId` was the NEW side of an adjustment. */
  findByNewLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanAdjustment | null>;
  /** Display-ready view for either side of an adjustment, whichever `loanAccountId` participated in — used by the Loan Detail page. */
  findViewByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanAdjustmentView | null>;
}
