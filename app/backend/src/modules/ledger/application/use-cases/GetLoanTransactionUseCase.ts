import { NotFoundError } from '@shared/errors/DomainError';
import type { LoanTransaction } from '../../domain/LoanTransaction';
import type { ILoanTransactionRepository } from '../ports/ILoanTransactionRepository';

export interface GetLoanTransactionUseCaseDeps {
  loanTransactionRepository: ILoanTransactionRepository;
}

export class GetLoanTransactionUseCase {
  constructor(private readonly deps: GetLoanTransactionUseCaseDeps) {}

  async execute(id: string): Promise<LoanTransaction> {
    const transaction = await this.deps.loanTransactionRepository.findById(id);
    if (!transaction) {
      throw new NotFoundError('LoanTransaction', id);
    }
    return transaction;
  }
}
