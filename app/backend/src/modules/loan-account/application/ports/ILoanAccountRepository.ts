import type { TransactionContext } from '@shared/application/TransactionContext';
import type { LoanAccount } from '../../domain/LoanAccount';

export interface ILoanAccountRepository {
  findById(id: string, ctx?: TransactionContext): Promise<LoanAccount | null>;
  findByLoanCode(loanCode: string, ctx?: TransactionContext): Promise<LoanAccount | null>;
  save(loanAccount: LoanAccount, ctx?: TransactionContext): Promise<void>;
}
