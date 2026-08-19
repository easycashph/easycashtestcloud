import type { Money } from '@shared/domain/Money';
import type { TransactionContext } from '@shared/application/TransactionContext';
import type { PenaltyCharge } from '../../domain/PenaltyCharge';

/** 2026-08-19 (unified Payment History timeline) — mirrors `FeeChargeView`'s own "view, not entity" rationale. */
export interface PenaltyChargeView {
  id: string;
  repaymentInstallmentId: string;
  installmentNumber: number;
  installmentDueDate: Date;
  loanTransactionId: string;
  previousPenaltyAmount: Money;
  newPenaltyAmount: Money;
  reason: string;
  chargedByUserId: string;
  chargedByName: string | null;
  createdAt: Date;
}

export interface IPenaltyChargeRepository {
  /** Immutable rows (see `PenaltyCharge`'s own doc comment) — never updated. */
  create(charge: PenaltyCharge, ctx?: TransactionContext): Promise<void>;
  /** Full history for one installment, oldest first. */
  findByRepaymentInstallmentId(repaymentInstallmentId: string, ctx?: TransactionContext): Promise<PenaltyCharge[]>;
  /** Every charge across every installment of one loan, oldest first — feeds the unified Payment History timeline. */
  findViewsByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<PenaltyChargeView[]>;
}
