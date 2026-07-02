import type { LoanAccount } from '../../domain/LoanAccount';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';

export interface ListLoanAccountsUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
}

export interface ListLoanAccountsInput {
  limit: number;
  cursor?: string;
}

export class ListLoanAccountsUseCase {
  constructor(private readonly deps: ListLoanAccountsUseCaseDeps) {}

  async execute(input: ListLoanAccountsInput): Promise<LoanAccount[]> {
    return this.deps.loanAccountRepository.findMany(input);
  }
}
