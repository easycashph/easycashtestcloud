import type { Money } from '@shared/domain/Money';
import type { TransactionContext } from '@shared/application/TransactionContext';
import type { FeeCharge } from '../../domain/FeeCharge';

/** 2026-08-15 (unified Payment History timeline) — see `FeeAdjustmentView`'s own doc comment for the "view, not entity" rationale. */
export interface FeeChargeView {
  id: string;
  repaymentInstallmentId: string;
  installmentNumber: number;
  installmentDueDate: Date;
  loanTransactionId: string;
  previousFeesAmount: Money;
  newFeesAmount: Money;
  reason: string;
  chargedByUserId: string;
  chargedByName: string | null;
  createdAt: Date;
}

export interface IFeeChargeRepository {
  /** Immutable rows (see `FeeCharge`'s own doc comment) — never updated. */
  create(charge: FeeCharge, ctx?: TransactionContext): Promise<void>;
  /** Full history for one installment, oldest first. */
  findByRepaymentInstallmentId(repaymentInstallmentId: string, ctx?: TransactionContext): Promise<FeeCharge[]>;
  /** Every charge across every installment of one loan, oldest first — feeds the unified Payment History timeline. */
  findViewsByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<FeeChargeView[]>;
}
