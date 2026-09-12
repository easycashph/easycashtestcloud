import { NotFoundError } from '@shared/errors/DomainError';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';
import type { LoanApplicationPreQualificationService } from '../services/LoanApplicationPreQualificationService';
import { assessLoanApplicationRisk } from '../services/LoanApplicationRiskAssessmentService';

export interface UpdateLoanApplicationIntakeUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  preQualificationService: LoanApplicationPreQualificationService;
}

export type UpdateLoanApplicationIntakeInput = Parameters<LoanApplication['updateStaffIntake']>[0];

/** 2026-08-12 (user request/bug fix) — LMS-staff counterpart to
 * UpdateLoanApplicationSelfServiceUseCase: same full intake field set and re-classification step,
 * but calls LoanApplication.updateStaffIntake() (PREAPPROVED/PREDECLINED/UNDER_REVIEW guard) instead
 * of updateSelfServiceIntake() (PREAPPROVED/PREDECLINED only), and is authorized via the loan
 * application router's staff role gate rather than portal-account ownership. */
export class UpdateLoanApplicationIntakeUseCase {
  constructor(private readonly deps: UpdateLoanApplicationIntakeUseCaseDeps) {}

  async execute(id: string, patch: UpdateLoanApplicationIntakeInput): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) throw new NotFoundError('LoanApplication', id);

    application.updateStaffIntake(patch);

    // Re-classify with whatever changed (address/amount/term/category/income all affect
    // eligibility) - no-ops via applySystemClassification's own guard once UNDER_REVIEW.
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
    const riskAssessment = assessLoanApplicationRisk(props.monthlyIncome, classification.estimatedMonthlyAmortization);
    application.applySystemClassification({ ...classification, dtiPercent: riskAssessment?.dtiPercent, riskTier: riskAssessment?.riskTier });

    await this.deps.loanApplicationRepository.save(application);
    return application;
  }
}
