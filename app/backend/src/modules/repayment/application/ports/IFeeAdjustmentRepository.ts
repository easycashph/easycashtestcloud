import type { TransactionContext } from '@shared/application/TransactionContext';
import type { FeeAdjustment } from '../../domain/FeeAdjustment';

export interface IFeeAdjustmentRepository {
  /** Immutable rows (see `FeeAdjustment`'s own doc comment) — never updated. */
  create(adjustment: FeeAdjustment, ctx?: TransactionContext): Promise<void>;
  /** Full history for one installment, oldest first — used by the Loan Detail page to show every past adjustment, not just the current override. */
  findByRepaymentInstallmentId(repaymentInstallmentId: string, ctx?: TransactionContext): Promise<FeeAdjustment[]>;
}
