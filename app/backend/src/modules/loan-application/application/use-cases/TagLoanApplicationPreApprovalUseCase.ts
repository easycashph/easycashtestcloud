import { NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { NotificationService } from '@modules/notification/application/NotificationService';
import type { ILoanProductRepository } from '@modules/loan-product/application/ports/ILoanProductRepository';
import { isSeafarerLoanProductName } from '@modules/loan-product/domain/ProductTypeClassification';
import { MissingAgencyVerificationError } from '../../domain/errors/LoanApplicationDomainErrors';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';

/** Final-approval roles - mirrors the frontend's `canApproveLoanApplication`. */
const PRE_APPROVAL_READY_NOTIFY_ROLES = ['MIS', 'Loan Operation Manager'];

export interface TagLoanApplicationPreApprovalUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  loanProductRepository: ILoanProductRepository;
  auditLogger: IAuditLogger;
  profileActivityLogService?: ProfileActivityLogService;
  notificationService?: NotificationService;
}

/**
 * "Tags as Pre Approval": UNDER_REVIEW -> PRE_APPROVAL, once the Review Report is complete.
 *
 * 2026-07-21: additionally requires the Review Report's Agency/Contract/Allotment verification
 * section (agency name, position, vessel — a minimal-but-meaningful subset, not every CER field)
 * to be filled in when the assigned product is a Seafarer Loan, mirroring the legacy CER template.
 */
export class TagLoanApplicationPreApprovalUseCase {
  constructor(private readonly deps: TagLoanApplicationPreApprovalUseCaseDeps) {}

  async execute(id: string, taggedByUserId: string): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) {
      throw new NotFoundError('LoanApplication', id);
    }

    if (application.assignedLoanProductVersionId) {
      const version = await this.deps.loanProductRepository.findVersionById(application.assignedLoanProductVersionId);
      const product = version ? await this.deps.loanProductRepository.findById(version.loanProductId) : null;
      if (product && isSeafarerLoanProductName(product.name)) {
        const agency = application.reviewReport?.agencyVerification;
        if (!agency?.agencyName?.trim() || !agency?.position?.trim() || !agency?.vessel?.trim()) {
          throw new MissingAgencyVerificationError();
        }
      }
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
