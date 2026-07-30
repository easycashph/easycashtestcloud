import { NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import type { LoanApplication, ReviewReport } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';

export interface SubmitLoanApplicationReviewReportUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  auditLogger: IAuditLogger;
}

/** Saves/merges the Review Report while UNDER_REVIEW. Deliberately no ProfileActivityLog entry
 * here - this is a draft-save action that may be called many times as the reviewer fills the form
 * field by field; only StartLoanApplicationReviewUseCase and TagLoanApplicationPreApprovalUseCase
 * (the actual stage transitions) write to the profile timeline. */
export class SubmitLoanApplicationReviewReportUseCase {
  constructor(private readonly deps: SubmitLoanApplicationReviewReportUseCaseDeps) {}

  async execute(id: string, submittedByUserId: string, patch: Partial<ReviewReport>): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) {
      throw new NotFoundError('LoanApplication', id);
    }

    // 2026-07-21: stamp who/when the document checklist was last touched, whenever the caller
    // actually sends a documentVerifications patch - matches the mockup's single "Verified by X -
    // date" footer for the whole checklist, not a per-document audit trail.
    const stampedPatch: Partial<ReviewReport> = patch.documentVerifications
      ? { ...patch, documentsVerifiedByUserId: submittedByUserId, documentsVerifiedAt: new Date().toISOString() }
      : patch;

    application.updateReviewReport(stampedPatch);
    await this.deps.loanApplicationRepository.save(application);
    await this.deps.auditLogger.log({
      userId: submittedByUserId,
      action: 'UPDATE_LOAN_APPLICATION_REVIEW_REPORT',
      entityType: 'LoanApplication',
      entityId: application.id,
      previousValue: undefined,
      newValue: { reviewReport: application.reviewReport },
    });

    return application;
  }
}
