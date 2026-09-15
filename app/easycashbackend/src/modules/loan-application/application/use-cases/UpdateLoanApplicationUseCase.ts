import { NotFoundError } from '@shared/errors/DomainError';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { INegativeAreaRepository } from '@modules/negative-area/application/ports/INegativeAreaRepository';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';
import type { LoanApplicationPreQualificationService } from '../services/LoanApplicationPreQualificationService';
import { assessLoanApplicationRisk } from '../services/LoanApplicationRiskAssessmentService';

export interface UpdateLoanApplicationUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  preQualificationService: LoanApplicationPreQualificationService;
  negativeAreaRepository: INegativeAreaRepository;
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
    const negativeAreas = await this.deps.negativeAreaRepository.list();
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
      negativeAreas,
    });
    const riskAssessment = assessLoanApplicationRisk(props.monthlyIncome, classification.estimatedMonthlyAmortization);
    application.applySystemClassification({ ...classification, dtiPercent: riskAssessment?.dtiPercent, riskTier: riskAssessment?.riskTier });

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
