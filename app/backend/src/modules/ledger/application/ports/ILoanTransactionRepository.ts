import type { TransactionContext } from '@shared/application/TransactionContext';
import type { LoanTransaction } from '../../domain/LoanTransaction';

export interface FindByLoanAccountIdOptions {
  /** Cursor-paginated by design (ADR-042 §6/§11) — this table is the system's highest-volume by construction; an unbounded "all transactions" read is not offered. */
  limit: number;
  cursor?: string;
  /** Milestone 8.1 / H-1: filters to one branch when supplied (a branch-scoped caller); omitted entirely for a global caller. */
  branchId?: string;
}

export interface ILoanTransactionRepository {
  findById(id: string, ctx?: TransactionContext): Promise<LoanTransaction | null>;
  findByLoanAccountId(
    loanAccountId: string,
    options: FindByLoanAccountIdOptions,
    ctx?: TransactionContext,
  ): Promise<LoanTransaction[]>;
  /**
   * TXN-1: append-only. Deliberately no `update()`/`delete()` method on
   * this port at all — the type signature itself makes editing a posted
   * transaction impossible from the application layer, not just
   * discouraged by convention.
   */
  create(transaction: LoanTransaction, ctx?: TransactionContext): Promise<void>;
}
