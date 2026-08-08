import type { TransactionContext } from '@shared/application/TransactionContext';
import type { LoanTransaction, LoanTransactionType } from '../../domain/LoanTransaction';

export interface FindByLoanAccountIdOptions {
  /** Cursor-paginated by design (ADR-042 §6/§11) — this table is the system's highest-volume by construction; an unbounded "all transactions" read is not offered. */
  limit: number;
  cursor?: string;
  /** Milestone 8.1 / H-1: filters to one branch when supplied (a branch-scoped caller); omitted entirely for a global caller. */
  branchId?: string;
  /** 2026-08-06 (Portal "Recent Payments" widget) - filters to one transaction type (e.g.
   * 'REPAYMENT' for "money the client actually paid in", excluding disbursements/fees/interest
   * accruals/etc. that also live in this same append-only ledger table). Omitted entirely for
   * every existing staff-facing caller, which still sees every transaction type unfiltered. */
  type?: LoanTransactionType;
}

export interface ILoanTransactionRepository {
  findById(id: string, ctx?: TransactionContext): Promise<LoanTransaction | null>;
  findByLoanAccountId(
    loanAccountId: string,
    options: FindByLoanAccountIdOptions,
    ctx?: TransactionContext,
  ): Promise<LoanTransaction[]>;
  /** 2026-07-11 (Reverse Payment feature): looks up the (at most one, per the schema's `@unique` constraint) REVERSAL transaction that already reverses `transactionId`, if any — how `ReversePaymentUseCase` rejects a double-reversal. */
  findByReversesTransactionId(transactionId: string, ctx?: TransactionContext): Promise<LoanTransaction | null>;
  /**
   * TXN-1: append-only. Deliberately no `update()` method on this port at
   * all — the type signature itself makes editing a posted transaction
   * impossible from the application layer, not just discouraged by
   * convention.
   */
  create(transaction: LoanTransaction, ctx?: TransactionContext): Promise<void>;
  /**
   * 2026-08-08 (Undo Restructure / Undo Adjustment feature, user-confirmed): the ONE narrow
   * exception to TXN-1's "no delete" rule — used only by `UndoRestructureLoanUseCase`/
   * `UndoAdjustLoanUseCase` to purge the transactions of a NEW loan account that is itself about
   * to be deleted outright (the account never had a real payment on it — that's guarded before
   * this is ever called). Not a general-purpose way to remove a posted transaction from a loan
   * that stays alive.
   */
  deleteAllByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<void>;
}
