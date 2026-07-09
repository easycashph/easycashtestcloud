import type { TransactionContext } from '@shared/application/TransactionContext';
import type { LoanAccount } from '../../domain/LoanAccount';

export interface FindManyLoanAccountsOptions {
  limit: number;
  cursor?: string;
  /** Milestone 8.1 / H-1: filters to one branch when supplied (a branch-scoped caller); omitted entirely for a global caller. */
  branchId?: string;
  /** Case-insensitive match against loanCode or the borrower's first/last name. */
  search?: string;
}

export interface ILoanAccountRepository {
  findById(id: string, ctx?: TransactionContext): Promise<LoanAccount | null>;
  findByLoanCode(loanCode: string, ctx?: TransactionContext): Promise<LoanAccount | null>;
  findMany(options: FindManyLoanAccountsOptions, ctx?: TransactionContext): Promise<LoanAccount[]>;
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
