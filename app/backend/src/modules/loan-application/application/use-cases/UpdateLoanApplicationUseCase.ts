import { NotFoundError } from '@shared/errors/DomainError';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';
import type { LoanApplicationPreQualificationService } from '../services/LoanApplicationPreQualificationService';

export interface UpdateLoanApplicationUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  preQualificationService: LoanApplicationPreQualificationService;
}

export interface UpdateLoanApplicationInput {
  monthlyIncome?: number;
  creditScore?: number;
  propertiesOwned?: string[];
}

export class UpdateLoanApplicationUseCase {
  constructor(private readonly deps: UpdateLoanApplicationUseCaseDeps) {}

  async execute(id: string, input: UpdateLoanApplicationInput): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) {
      throw new NotFoundError('LoanApplication', id);
    }
    application.updateApplicantFinancials(input);

    // Re-classify with the freshly saved income — no-ops (via applySystemClassification's own
    // guard) once a human has already made the real APPROVED/DECLINED decision.
    const props = application.toProps();
    const classification = await this.deps.preQualificationService.classify({
      branchId: props.branchId,
      age: props.age,
      monthlyIncome: props.monthlyIncome,
      requestedAmount: props.requestedAmount,
      requestedTermMonths: props.requestedTermMonths,
      requestedCategory: props.requestedCategory,
      applicantAddressText: props.address,
    });
    application.applySystemClassification(classification);

    await this.deps.loanApplicationRepository.save(application);
    return application;
  }
}
