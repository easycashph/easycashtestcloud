import { NotFoundError } from '@shared/errors/DomainError';
import type { LoanAccount } from '../../domain/LoanAccount';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';

export interface GetLoanAccountUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
}

export class GetLoanAccountUseCase {
  constructor(private readonly deps: GetLoanAccountUseCaseDeps) {}

  async execute(id: string): Promise<LoanAccount> {
    const loanAccount = await this.deps.loanAccountRepository.findById(id);
    if (!loanAccount) {
      throw new NotFoundError('LoanAccount', id);
    }
    return loanAccount;
  }
}
