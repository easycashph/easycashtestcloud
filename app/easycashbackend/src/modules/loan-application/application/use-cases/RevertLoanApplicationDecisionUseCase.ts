import { NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { IAttachmentRepository } from '@modules/document/application/ports/IAttachmentRepository';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';
import type { LoanApplicationPreQualificationService } from '../services/LoanApplicationPreQualificationService';
import { assessLoanApplicationRisk } from '../services/LoanApplicationRiskAssessmentService';
import { getRequiredDocumentCategories, isDocumentComplete } from '../config/requiredDocumentCategories';

export interface RevertLoanApplicationDecisionUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  auditLogger: IAuditLogger;
  preQualificationService: LoanApplicationPreQualificationService;
  attachmentRepository: IAttachmentRepository;
  profileActivityLogService?: ProfileActivityLogService;
}

/** MIS-only — role gating happens at the router (requireRole), not here; this use case only knows the state transition. */
export class RevertLoanApplicationDecisionUseCase {
  constructor(private readonly deps: RevertLoanApplicationDecisionUseCaseDeps) {}

  async execute(id: string, revertedByUserId: string): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) {
      throw new NotFoundError('LoanApplication', id);
    }

    const previousStatus = application.status;
    const props = application.toProps();
    // Revert always reflects current data (a fresh classification), never a memorized old value —
    // e.g. income recorded after the original decision now factors into where it lands.
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

    // 2026-09-12 (user request): revert also has to reflect the INCOMPLETE stage, not just
    // PREAPPROVED/PREDECLINED - reverting an application whose documents are still (or again)
    // incomplete should land it back on INCOMPLETE, not a classification that's not really valid
    // yet. Documents are additive-only in this codebase, but a decision made before the
    // documents-completeness check existed (or of an application that was declined straight from
    // INCOMPLETE) can still legitimately revert to INCOMPLETE.
    const requiredCategories = getRequiredDocumentCategories(props.requestedCategory, Boolean(props.coBorrowerFirstName || props.coBorrowerName));
    const attachments = await this.deps.attachmentRepository.listByOwner('LOAN_APPLICATION', id);
    const documentsComplete = isDocumentComplete(requiredCategories, attachments.map((a) => a.documentCategory));

    const riskAssessment = assessLoanApplicationRisk(props.monthlyIncome, classification.estimatedMonthlyAmortization);
    const targetStatus = documentsComplete ? classification.status : 'INCOMPLETE';
    application.revert(targetStatus, { dtiPercent: riskAssessment?.dtiPercent, riskTier: riskAssessment?.riskTier });
    await this.deps.loanApplicationRepository.save(application);
    await this.deps.auditLogger.log({
      userId: revertedByUserId,
      action: 'REVERT_LOAN_APPLICATION_DECISION',
      entityType: 'LoanApplication',
      entityId: application.id,
      previousValue: { status: previousStatus },
      newValue: { status: targetStatus },
    });

    // ADR-050: Log activity for profile timeline
    if (this.deps.profileActivityLogService) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'LOAN_APPLICATION',
        profileId: application.id,
        userId: revertedByUserId,
        ...ProfileActivityLogService.actions.decisionUpdated(previousStatus, targetStatus, 'Decision reverted to pending'),
      });
    }

    return application;
  }
}
