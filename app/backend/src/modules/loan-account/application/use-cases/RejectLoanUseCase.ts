import { NotFoundError } from '@shared/errors/DomainError';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';

export interface RejectLoanUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
}

export class RejectLoanUseCase {
  constructor(private readonly deps: RejectLoanUseCaseDeps) {}

  async execute(loanAccountId: string, reason?: string): Promise<void> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) {
      throw new NotFoundError('LoanAccount', loanAccountId);
    }

    loanAccount.reject(reason);
    await this.deps.loanAccountRepository.save(loanAccount);
  }
}
