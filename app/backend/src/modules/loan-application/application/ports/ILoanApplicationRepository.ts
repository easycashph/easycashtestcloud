import type { LoanApplication } from '../../domain/LoanApplication';
import type { TransactionContext } from '@shared/application/TransactionContext';

export interface FindManyLoanApplicationsOptions {
  limit: number;
  cursor?: string;
  branchId?: string;
  /** Case-insensitive match against applicantName. */
  search?: string;
}

export interface ILoanApplicationRepository {
  findById(id: string, ctx?: TransactionContext): Promise<LoanApplication | null>;
  findMany(options: FindManyLoanApplicationsOptions, ctx?: TransactionContext): Promise<LoanApplication[]>;
  save(application: LoanApplication, ctx?: TransactionContext): Promise<void>;
}
