import type { IAttachmentRepository } from '@modules/document/application/ports/IAttachmentRepository';
import type { INegativeAreaRepository } from '@modules/negative-area/application/ports/INegativeAreaRepository';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';
import type { LoanApplicationPreQualificationService } from '../services/LoanApplicationPreQualificationService';
import { assessLoanApplicationRisk } from '../services/LoanApplicationRiskAssessmentService';
import { getRequiredDocumentCategories, isDocumentComplete } from '../config/requiredDocumentCategories';

export interface RecheckLoanApplicationDocumentCompletenessUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  attachmentRepository: IAttachmentRepository;
  preQualificationService: LoanApplicationPreQualificationService;
  negativeAreaRepository: INegativeAreaRepository;
}

/**
 * 2026-09-12 (user request): called after every attachment uploaded against a LOAN_APPLICATION
 * owner (see documentController.upload) - no-ops instantly unless that application is currently
 * INCOMPLETE, so it's cheap to call unconditionally on every upload rather than the caller having
 * to know when a recheck might matter. Once every category `getRequiredDocumentCategories` lists
 * has an uploaded attachment, runs the same pre-qualification + DTI classification
 * CreateLoanApplicationUseCase runs at creation, and transitions INCOMPLETE -> PREAPPROVED/
 * PREDECLINED via LoanApplication.completeDocuments().
 */
export class RecheckLoanApplicationDocumentCompletenessUseCase {
  constructor(private readonly deps: RecheckLoanApplicationDocumentCompletenessUseCaseDeps) {}

  async execute(loanApplicationId: string): Promise<void> {
    const application = await this.deps.loanApplicationRepository.findById(loanApplicationId);
    if (!application || application.status !== 'INCOMPLETE') return;

    const p = application.toProps();
    const required = getRequiredDocumentCategories(p.requestedCategory, Boolean(p.coBorrowerFirstName || p.coBorrowerName));
    const attachments = await this.deps.attachmentRepository.listByOwner('LOAN_APPLICATION', loanApplicationId);
    if (!isDocumentComplete(required, attachments.map((a) => a.documentCategory))) return;

    const negativeAreas = await this.deps.negativeAreaRepository.list();
    const classification = await this.deps.preQualificationService.classify({
      branchId: p.branchId,
      age: p.age,
      monthlyIncome: p.monthlyIncome,
      requestedAmount: p.requestedAmount,
      requestedTermMonths: p.requestedTermMonths,
      requestedCategory: p.requestedCategory,
      applicantAddressText: p.address,
      occupation: p.occupation,
      employer: p.employer,
      negativeAreas,
    });
    const riskAssessment = assessLoanApplicationRisk(p.monthlyIncome, classification.estimatedMonthlyAmortization);

    application.completeDocuments({
      status: classification.status,
      distanceFromBranchKm: classification.distanceFromBranchKm,
      dtiPercent: riskAssessment?.dtiPercent,
      riskTier: riskAssessment?.riskTier,
    });
    await this.deps.loanApplicationRepository.save(application);
  }
}
