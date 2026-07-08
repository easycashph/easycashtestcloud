import { NotFoundError } from '@shared/errors/DomainError';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';

export interface GetLoanApplicationUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
}

export class GetLoanApplicationUseCase {
  constructor(private readonly deps: GetLoanApplicationUseCaseDeps) {}

  async execute(id: string): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) {
      throw new NotFoundError('LoanApplication', id);
    }
    return application;
  }
}
