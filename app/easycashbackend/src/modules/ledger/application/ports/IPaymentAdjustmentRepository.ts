import type { TransactionContext } from '@shared/application/TransactionContext';
import type { PaymentAdjustment } from '../../domain/PaymentAdjustment';

export interface IPaymentAdjustmentRepository {
  /** Immutable rows (see `PaymentAdjustment`'s own doc comment) — created alongside the ADJUSTMENT transaction they explain, never updated. */
  createMany(adjustments: readonly PaymentAdjustment[], ctx?: TransactionContext): Promise<void>;
  /** Shown on the Loan Detail page's transaction history to explain why a legacy transaction's figures were later corrected. */
  findByLoanTransactionId(loanTransactionId: string, ctx?: TransactionContext): Promise<PaymentAdjustment[]>;
}
