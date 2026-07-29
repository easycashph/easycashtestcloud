import type { TransactionContext } from '@shared/application/TransactionContext';
import type { RepaymentInstallment } from '../../domain/RepaymentInstallment';

export interface IRepaymentInstallmentRepository {
  findById(id: string, ctx?: TransactionContext): Promise<RepaymentInstallment | null>;
  /** Bounded by construction — an installment schedule per loan is at most in the low hundreds, unlike the ledger (ADR-042 §7/§11), so no pagination is required here. */
  findByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<RepaymentInstallment[]>;
  /**
   * Milestone 9.1 checkpoint 6 / `docs/Architecture/ADR-optimistic-
   * concurrency.md`: for an existing installment, throws
   * `ConcurrencyConflictError` if `installment.version` no longer matches
   * the persisted row. The caller must not blindly retry with the same
   * stale instance — re-fetch and re-apply the intended change.
   */
  save(installment: RepaymentInstallment, ctx?: TransactionContext): Promise<void>;
  /** Same conditional-write/`ConcurrencyConflictError` contract as `save()`, applied per row; the whole batch commits or rolls back atomically. */
  saveMany(installments: RepaymentInstallment[], ctx?: TransactionContext): Promise<void>;
  /**
   * 2026-07-16 (Undo Activate, user request, MIS-only) — deletes every installment for a loan
   * whose activation is being undone. Safe only because `UndoActivateLoanUseCase` has already
   * confirmed none of them carry a payment or a penalty/fee override before calling this; unlike
   * `LoanTransaction` (TXN-1, no delete method at all), a not-yet-touched `RepaymentInstallment`
   * has no append-only requirement of its own.
   */
  deleteAllByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<void>;
}
