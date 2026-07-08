import { NotFoundError } from '@shared/errors/DomainError';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';

export interface AssignLoanApplicationProductUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
}

export class AssignLoanApplicationProductUseCase {
  constructor(private readonly deps: AssignLoanApplicationProductUseCaseDeps) {}

  async execute(id: string, loanProductVersionId: string): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) {
      throw new NotFoundError('LoanApplication', id);
    }
    application.assignProduct(loanProductVersionId);
    await this.deps.loanApplicationRepository.save(application);
    return application;
  }
}
