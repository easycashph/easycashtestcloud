import type { TransactionContext } from '@shared/application/TransactionContext';
import type { PaymentAllocation } from '../../domain/PaymentAllocation';

export interface IPaymentAllocationRepository {
  /** Immutable rows (see `PaymentAllocation`'s own doc comment) — batch-inserted alongside the transaction they describe, never updated. */
  createMany(allocations: readonly PaymentAllocation[], ctx?: TransactionContext): Promise<void>;
  /** What `ReversePaymentUseCase` reads to know exactly what a given REPAYMENT transaction touched. */
  findByLoanTransactionId(loanTransactionId: string, ctx?: TransactionContext): Promise<PaymentAllocation[]>;
}
