import type { TransactionContext } from '@shared/application/TransactionContext';
import type { LoanAccount } from '../../domain/LoanAccount';

export interface FindManyLoanAccountsOptions {
  limit: number;
  cursor?: string;
  /** Milestone 8.1 / H-1: filters to one branch when supplied (a branch-scoped caller); omitted entirely for a global caller. */
  branchId?: string;
  /** Case-insensitive match against loanCode or the borrower's first/last name. */
  search?: string;
  /** Frontend↔Backend Wiring Pilot follow-up (2026-07-09): filters to one borrower's loan history — read-only, combinable with branchId. */
  borrowerId?: string;
}

export interface ILoanAccountRepository {
  findById(id: string, ctx?: TransactionContext): Promise<LoanAccount | null>;
  findByLoanCode(loanCode: string, ctx?: TransactionContext): Promise<LoanAccount | null>;
  findMany(options: FindManyLoanAccountsOptions, ctx?: TransactionContext): Promise<LoanAccount[]>;
  /**
   * 2026-07-11 (Create Loan Account): the highest numeric suffix among existing loan codes of the
   * form `{prefix}_NNNNN` (matches the real convention observed across migrated legacy data, e.g.
   * `SML-REG_00377`) — 0 if none exist yet. Used to auto-generate the next code; not atomic against
   * concurrent creates for the same prefix (acceptable for a low-frequency, staff-driven action,
   * not a high-throughput one).
   */
  findMaxLoanCodeSequenceForPrefix(prefix: string, ctx?: TransactionContext): Promise<number>;
  /**
   * Milestone 9.1 checkpoint 6 / `docs/Architecture/ADR-optimistic-
   * concurrency.md`: for an existing aggregate, throws
   * `ConcurrencyConflictError` if `loanAccount.version` no longer matches
   * the persisted row (another writer moved it forward since this
   * aggregate was loaded). The caller must not blindly retry with the
   * same stale instance — re-fetch and re-apply the intended change.
   */
  save(loanAccount: LoanAccount, ctx?: TransactionContext): Promise<void>;
}
