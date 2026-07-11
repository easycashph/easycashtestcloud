import { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';
import type { CreateLoanApplicationInput } from '../dtos/LoanApplicationDtos';
import type { LoanApplicationPreQualificationService } from '../services/LoanApplicationPreQualificationService';

export interface CreateLoanApplicationUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  preQualificationService: LoanApplicationPreQualificationService;
}

export class CreateLoanApplicationUseCase {
  constructor(private readonly deps: CreateLoanApplicationUseCaseDeps) {}

  async execute(input: CreateLoanApplicationInput): Promise<LoanApplication> {
    const classification = await this.deps.preQualificationService.classify({
      branchId: input.branchId,
      age: input.age,
      monthlyIncome: input.monthlyIncome,
      requestedAmount: input.requestedAmount,
      requestedTermMonths: input.requestedTermMonths,
      requestedCategory: input.requestedCategory,
      applicantAddressText: input.address,
    });

    const application = LoanApplication.create({
      ...input,
      status: classification.status,
      distanceFromBranchKm: classification.distanceFromBranchKm ?? undefined,
    });
    await this.deps.loanApplicationRepository.save(application);
    return application;
  }
}
