import { NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { NotificationService } from '@modules/notification/application/NotificationService';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';

/** Final-approval roles - mirrors the frontend's `canApproveLoanApplication`. */
const PRE_APPROVAL_READY_NOTIFY_ROLES = ['MIS', 'Loan Operation Manager'];

export interface TagLoanApplicationPreApprovalUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  auditLogger: IAuditLogger;
  profileActivityLogService?: ProfileActivityLogService;
  notificationService?: NotificationService;
}

/**
 * "Tags as Pre Approval": UNDER_REVIEW -> PRE_APPROVAL, once the Review Report is complete.
 *
 * 2026-07-21 introduced, 2026-07-25 removed (user decision): used to additionally require the
 * Review Report's Agency/Contract/Allotment verification section (agency name, position, vessel)
 * to be filled in when the assigned product is a Seafarer Loan. That gate is gone - Agency
 * Verification fields are no longer required to Tag as Pre Approval, though the section and its
 * fields still exist on the Review Report for staff to fill in if they choose to.
 */
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

    // Notification Center (2026-07-17): tell final approvers this application is ready for them.
    if (this.deps.notificationService) {
      await this.deps.notificationService.notifyRoles({
        roleNames: PRE_APPROVAL_READY_NOTIFY_ROLES,
        branchId: application.branchId,
        type: 'APPLICATION_PRE_APPROVAL_READY',
        title: `Ready for final approval: ${application.applicantName}`,
        entityType: 'LoanApplication',
        entityId: application.id,
        excludeUserId: taggedByUserId,
      });
    }

    return application;
  }
}
