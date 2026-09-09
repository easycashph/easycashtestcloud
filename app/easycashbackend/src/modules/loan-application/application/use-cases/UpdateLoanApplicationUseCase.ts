import { NotFoundError } from '@shared/errors/DomainError';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';
import type { LoanApplicationPreQualificationService } from '../services/LoanApplicationPreQualificationService';

export interface UpdateLoanApplicationUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  preQualificationService: LoanApplicationPreQualificationService;
  profileActivityLogService?: ProfileActivityLogService;
}

export interface UpdateLoanApplicationInput {
  monthlyIncome?: number;
  creditScore?: number;
  propertiesOwned?: string[];
}

export class UpdateLoanApplicationUseCase {
  constructor(private readonly deps: UpdateLoanApplicationUseCaseDeps) {}

  async execute(id: string, input: UpdateLoanApplicationInput, updatedByUserId?: string): Promise<LoanApplication> {
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
      occupation: props.occupation,
      employer: props.employer,
    });
    application.applySystemClassification(classification);

    await this.deps.loanApplicationRepository.save(application);

    // ADR-050: Log activity for profile timeline
    if (this.deps.profileActivityLogService && updatedByUserId) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'LOAN_APPLICATION',
        profileId: application.id,
        userId: updatedByUserId,
        action: 'financials_updated',
        details: { fields: Object.keys(input) },
      });
    }

    return application;
  }
}
