import type { TransactionContext } from '@shared/application/TransactionContext';
import type { LoanProduct } from '../../domain/LoanProduct';

export interface ILoanProductRepository {
  findById(id: string, ctx?: TransactionContext): Promise<LoanProduct | null>;
  findByCode(code: string, ctx?: TransactionContext): Promise<LoanProduct | null>;
  /** Persists the product AND its full versions[]/penaltyRule/feeRules[] graph atomically. */
  save(loanProduct: LoanProduct, ctx?: TransactionContext): Promise<void>;
}
