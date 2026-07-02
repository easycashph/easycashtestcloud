import type { TransactionContext } from '@shared/application/TransactionContext';
import type { LoanAccount } from '../../domain/LoanAccount';

export interface FindManyLoanAccountsOptions {
  /** Cursor-paginated (Milestone 8 / D-4: limit + cursor only, no search/filter/sort). */
  limit: number;
  cursor?: string;
  /** Milestone 8.1 / H-1: filters to one branch when supplied (a branch-scoped caller); omitted entirely for a global caller. */
  branchId?: string;
}

export interface ILoanAccountRepository {
  findById(id: string, ctx?: TransactionContext): Promise<LoanAccount | null>;
  findByLoanCode(loanCode: string, ctx?: TransactionContext): Promise<LoanAccount | null>;
  findMany(options: FindManyLoanAccountsOptions, ctx?: TransactionContext): Promise<LoanAccount[]>;
  save(loanAccount: LoanAccount, ctx?: TransactionContext): Promise<void>;
}
