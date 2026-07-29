import type { Money } from '@shared/domain/Money';
import type { TransactionContext } from '@shared/application/TransactionContext';
import type { FeeAdjustment } from '../../domain/FeeAdjustment';

/** 2026-07-16 (unified Payment History timeline) — see `PenaltyReductionView`'s own doc comment for the "view, not entity" rationale. */
export interface FeeAdjustmentView {
  id: string;
  repaymentInstallmentId: string;
  installmentNumber: number;
  installmentDueDate: Date;
  previousFeesAmount: Money;
  newFeesAmount: Money;
  reason: string;
  adjustedByUserId: string;
  adjustedByName: string | null;
  createdAt: Date;
}

export interface IFeeAdjustmentRepository {
  /** Immutable rows (see `FeeAdjustment`'s own doc comment) — never updated. */
  create(adjustment: FeeAdjustment, ctx?: TransactionContext): Promise<void>;
  /** Full history for one installment, oldest first — used by the Loan Detail page to show every past adjustment, not just the current override. */
  findByRepaymentInstallmentId(repaymentInstallmentId: string, ctx?: TransactionContext): Promise<FeeAdjustment[]>;
  /** Every adjustment across every installment of one loan, oldest first — feeds the unified Payment History timeline. */
  findViewsByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<FeeAdjustmentView[]>;
}
