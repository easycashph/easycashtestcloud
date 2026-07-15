import type { TransactionContext } from '@shared/application/TransactionContext';
import type { PenaltyReduction } from '../../domain/PenaltyReduction';

export interface IPenaltyReductionRepository {
  /** Immutable rows (see `PenaltyReduction`'s own doc comment) — never updated. */
  create(reduction: PenaltyReduction, ctx?: TransactionContext): Promise<void>;
  /** Full history for one installment, oldest first — used by the Loan Detail page to show every past reduction, not just the current override. */
  findByRepaymentInstallmentId(repaymentInstallmentId: string, ctx?: TransactionContext): Promise<PenaltyReduction[]>;
}
