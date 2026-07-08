import { NotFoundError } from '@shared/errors/DomainError';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';

export interface MarkLoanApplicationReviewedUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
}

export class MarkLoanApplicationReviewedUseCase {
  constructor(private readonly deps: MarkLoanApplicationReviewedUseCaseDeps) {}

  async execute(id: string): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) {
      throw new NotFoundError('LoanApplication', id);
    }
    application.markReviewed();
    await this.deps.loanApplicationRepository.save(application);
    return application;
  }
}
