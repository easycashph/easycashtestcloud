import type { TransactionContext } from '@shared/application/TransactionContext';
import type { LoanProduct } from '../../domain/LoanProduct';

export interface FindManyLoanProductsOptions {
  /** Cursor-paginated (Milestone 8 / D-4: limit + cursor only, no search/filter/sort). */
  limit: number;
  cursor?: string;
}

export interface ILoanProductRepository {
  findById(id: string, ctx?: TransactionContext): Promise<LoanProduct | null>;
  findByCode(code: string, ctx?: TransactionContext): Promise<LoanProduct | null>;
  findMany(options: FindManyLoanProductsOptions, ctx?: TransactionContext): Promise<LoanProduct[]>;
  /** Persists the product AND its full versions[]/penaltyRule/feeRules[] graph atomically. */
  save(loanProduct: LoanProduct, ctx?: TransactionContext): Promise<void>;
}
