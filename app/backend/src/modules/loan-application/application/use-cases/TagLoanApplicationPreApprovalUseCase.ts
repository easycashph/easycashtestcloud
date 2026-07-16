import { NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';

export interface TagLoanApplicationPreApprovalUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  auditLogger: IAuditLogger;
  profileActivityLogService?: ProfileActivityLogService;
}

/** "Tags as Pre Approval": UNDER_REVIEW -> PRE_APPROVAL, once the Review Report is complete. */
export class TagLoanApplicationPreApprovalUseCase {
  constructor(private readonly deps: TagLoanApplicationPreApprovalUseCaseDeps) {}

  async execute(id: string, taggedByUserId: string): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) {
      throw new NotFoundError('LoanApplication', id);
    }

    const previousStatus = application.status;
    application.tagPreApproval(taggedByUserId);
    await this.deps.loanApplicationRepository.save(application);
    await this.deps.auditLogger.log({
      userId: taggedByUserId,
      action: 'TAG_LOAN_APPLICATION_PRE_APPROVAL',
      entityType: 'LoanApplication',
      entityId: application.id,
      previousValue: { status: previousStatus },
      newValue: { status: 'PRE_APPROVAL' },
    });

    if (this.deps.profileActivityLogService) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'LOAN_APPLICATION',
        profileId: application.id,
        userId: taggedByUserId,
        ...ProfileActivityLogService.actions.decisionUpdated(previousStatus, 'PRE_APPROVAL'),
      });
    }

    return application;
  }
}
