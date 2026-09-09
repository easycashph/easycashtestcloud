import { NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';

export interface UndoLoanApplicationPreApprovalUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  auditLogger: IAuditLogger;
  profileActivityLogService?: ProfileActivityLogService;
}

/**
 * 2026-09-09 (user request): "Undo" for Tag as Pre Approval - PRE_APPROVAL -> UNDER_REVIEW, a
 * direct one-step counterpart to TagLoanApplicationPreApprovalUseCase. See
 * LoanApplication.undoPreApproval()'s own doc comment for why this exists alongside revert()
 * rather than reusing it.
 */
export class UndoLoanApplicationPreApprovalUseCase {
  constructor(private readonly deps: UndoLoanApplicationPreApprovalUseCaseDeps) {}

  async execute(id: string, undoneByUserId: string): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) {
      throw new NotFoundError('LoanApplication', id);
    }

    const previousStatus = application.status;
    application.undoPreApproval();
    await this.deps.loanApplicationRepository.save(application);
    await this.deps.auditLogger.log({
      userId: undoneByUserId,
      action: 'UNDO_LOAN_APPLICATION_PRE_APPROVAL',
      entityType: 'LoanApplication',
      entityId: application.id,
      previousValue: { status: previousStatus },
      newValue: { status: 'UNDER_REVIEW' },
    });

    if (this.deps.profileActivityLogService) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'LOAN_APPLICATION',
        profileId: application.id,
        userId: undoneByUserId,
        ...ProfileActivityLogService.actions.decisionUpdated(previousStatus, 'UNDER_REVIEW'),
      });
    }

    return application;
  }
}
