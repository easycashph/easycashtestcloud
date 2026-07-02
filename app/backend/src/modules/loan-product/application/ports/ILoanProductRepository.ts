import type { TransactionContext } from '@shared/application/TransactionContext';
import type { LoanProduct } from '../../domain/LoanProduct';
import type { LoanProductVersion } from '../../domain/LoanProductVersion';

export interface FindManyLoanProductsOptions {
  /** Cursor-paginated (Milestone 8 / D-4: limit + cursor only, no search/filter/sort). */
  limit: number;
  cursor?: string;
}

export interface ILoanProductRepository {
  findById(id: string, ctx?: TransactionContext): Promise<LoanProduct | null>;
  findByCode(code: string, ctx?: TransactionContext): Promise<LoanProduct | null>;
  findMany(options: FindManyLoanProductsOptions, ctx?: TransactionContext): Promise<LoanProduct[]>;
  /**
   * Milestone 8 / D-3: looks up a single version WITHOUT loading its
   * parent LoanProduct — used by loan-account's range validation, which
   * only needs the version's configured min/max, not the whole product
   * graph.
   */
  findVersionById(versionId: string, ctx?: TransactionContext): Promise<LoanProductVersion | null>;
  /** Persists the product AND its full versions[]/penaltyRule/feeRules[] graph atomically. */
  save(loanProduct: LoanProduct, ctx?: TransactionContext): Promise<void>;
}
