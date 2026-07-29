import type { Money } from '@shared/domain/Money';
import type { TransactionContext } from '@shared/application/TransactionContext';
import type { PenaltyReduction } from '../../domain/PenaltyReduction';

/**
 * 2026-07-16 (unified Payment History timeline): a read-model shape, not the domain entity —
 * carries the installment/user context `PenaltyReduction` itself deliberately doesn't (that's a
 * display-join concern, not part of the aggregate's own state). Same "view, not entity" posture as
 * `GeneratedLoanDocumentView`.
 */
export interface PenaltyReductionView {
  id: string;
  repaymentInstallmentId: string;
  installmentNumber: number;
  installmentDueDate: Date;
  previousPenaltyAmount: Money;
  newPenaltyAmount: Money;
  reason: string;
  reducedByUserId: string;
  reducedByName: string | null;
  createdAt: Date;
}

export interface IPenaltyReductionRepository {
  /** Immutable rows (see `PenaltyReduction`'s own doc comment) — never updated. */
  create(reduction: PenaltyReduction, ctx?: TransactionContext): Promise<void>;
  /** Full history for one installment, oldest first — used by the Loan Detail page to show every past reduction, not just the current override. */
  findByRepaymentInstallmentId(repaymentInstallmentId: string, ctx?: TransactionContext): Promise<PenaltyReduction[]>;
  /** Every reduction across every installment of one loan, oldest first — feeds the unified Payment History timeline. */
  findViewsByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<PenaltyReductionView[]>;
}
