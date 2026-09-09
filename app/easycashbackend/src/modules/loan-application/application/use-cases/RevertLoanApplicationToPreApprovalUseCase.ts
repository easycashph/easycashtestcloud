import { NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';

export interface RevertLoanApplicationToPreApprovalUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  auditLogger: IAuditLogger;
  profileActivityLogService?: ProfileActivityLogService;
}

/**
 * 2026-09-09 (user request): "Revert to Pre-Approval" - APPROVED/DECLINED -> PRE_APPROVAL, a
 * one-step-back alternative to RevertLoanApplicationDecisionUseCase's full revert to a freshly
 * recomputed system pre-qualification. See LoanApplication.revertToPreApproval()'s own doc comment
 * for the field semantics. Gated on its own dedicated permission at the router
 * (loan_application.revert_to_pre_approval), defaulted OFF for every role except MIS.
 */
export class RevertLoanApplicationToPreApprovalUseCase {
  constructor(private readonly deps: RevertLoanApplicationToPreApprovalUseCaseDeps) {}

  async execute(id: string, revertedByUserId: string): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) {
      throw new NotFoundError('LoanApplication', id);
    }

    const previousStatus = application.status;
    application.revertToPreApproval();
    await this.deps.loanApplicationRepository.save(application);
    await this.deps.auditLogger.log({
      userId: revertedByUserId,
      action: 'REVERT_LOAN_APPLICATION_TO_PRE_APPROVAL',
      entityType: 'LoanApplication',
      entityId: application.id,
      previousValue: { status: previousStatus },
      newValue: { status: 'PRE_APPROVAL' },
    });

    if (this.deps.profileActivityLogService) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'LOAN_APPLICATION',
        profileId: application.id,
        userId: revertedByUserId,
        ...ProfileActivityLogService.actions.decisionUpdated(previousStatus, 'PRE_APPROVAL', 'Decision reverted to Pre-Approval'),
      });
    }

    return application;
  }
}
