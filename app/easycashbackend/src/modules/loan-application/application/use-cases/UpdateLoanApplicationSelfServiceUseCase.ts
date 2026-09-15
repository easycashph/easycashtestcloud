import { NotFoundError } from '@shared/errors/DomainError';
import type { INegativeAreaRepository } from '@modules/negative-area/application/ports/INegativeAreaRepository';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';
import type { LoanApplicationPreQualificationService } from '../services/LoanApplicationPreQualificationService';
import { assessLoanApplicationRisk } from '../services/LoanApplicationRiskAssessmentService';

export interface UpdateLoanApplicationSelfServiceUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  preQualificationService: LoanApplicationPreQualificationService;
  negativeAreaRepository: INegativeAreaRepository;
}

export type UpdateLoanApplicationSelfServiceInput = Parameters<LoanApplication['updateSelfServiceIntake']>[0];

/** 2026-07-24 (user request) — backs the Easycash Portal's "edit my application" flow. Separate
 * from UpdateLoanApplicationUseCase (which only ever touches the 3 Risk Management Summary
 * fields, staff-only) - this one covers the full self-service intake field set instead, guarded
 * by LoanApplication.updateSelfServiceIntake()'s own "no decision made yet" check. Authorization
 * (does this application actually belong to the calling portal account?) is the caller's
 * responsibility - see client-portal's UpdatePortalLoanApplicationUseCase, which wraps this. */
export class UpdateLoanApplicationSelfServiceUseCase {
  constructor(private readonly deps: UpdateLoanApplicationSelfServiceUseCaseDeps) {}

  async execute(id: string, patch: UpdateLoanApplicationSelfServiceInput): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) throw new NotFoundError('LoanApplication', id);

    application.updateSelfServiceIntake(patch);

    // Re-classify with whatever changed (address/amount/term/category/income all affect
    // eligibility) - no-ops via applySystemClassification's own guard if a decision somehow landed
    // between the read above and here.
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
    return application;
  }
}
