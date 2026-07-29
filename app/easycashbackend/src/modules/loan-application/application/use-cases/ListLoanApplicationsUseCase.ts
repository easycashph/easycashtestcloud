import type { LoanApplication } from '../../domain/LoanApplication';
import type { FindManyLoanApplicationsOptions, ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';

export interface ListLoanApplicationsUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
}

export class ListLoanApplicationsUseCase {
  constructor(private readonly deps: ListLoanApplicationsUseCaseDeps) {}

  async execute(options: FindManyLoanApplicationsOptions): Promise<LoanApplication[]> {
    return this.deps.loanApplicationRepository.findMany(options);
  }
}
