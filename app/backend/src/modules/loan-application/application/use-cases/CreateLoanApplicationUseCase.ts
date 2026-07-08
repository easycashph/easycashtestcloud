import { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';
import type { CreateLoanApplicationInput } from '../dtos/LoanApplicationDtos';

export interface CreateLoanApplicationUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
}

export class CreateLoanApplicationUseCase {
  constructor(private readonly deps: CreateLoanApplicationUseCaseDeps) {}

  async execute(input: CreateLoanApplicationInput): Promise<LoanApplication> {
    const application = LoanApplication.create(input);
    await this.deps.loanApplicationRepository.save(application);
    return application;
  }
}
