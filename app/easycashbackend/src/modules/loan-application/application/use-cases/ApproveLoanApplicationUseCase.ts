import { NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { NotificationService } from '@modules/notification/application/NotificationService';
import type { PortalNotificationService } from '@modules/client-portal/application/PortalNotificationService';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';

export interface ApproveLoanApplicationUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  auditLogger: IAuditLogger;
  profileActivityLogService?: ProfileActivityLogService;
  notificationService?: NotificationService;
  portalNotificationService?: PortalNotificationService;
  /** 2026-08-14 (detailed portal notifications, user request) - resolves `reviewedByUserId` to a
   * display name for the portal notification title. Optional so this use case still works in
   * tests/contexts that don't wire it - falls back to a generic "an Easycash loan officer" phrase. */
  userRepository?: IUserRepository;
}

export class ApproveLoanApplicationUseCase {
  constructor(private readonly deps: ApproveLoanApplicationUseCaseDeps) {}

  async execute(id: string, reviewedByUserId: string, decisionNote: string | undefined): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) {
      throw new NotFoundError('LoanApplication', id);
    }

    const previousStatus = application.status;
    application.approve(reviewedByUserId, decisionNote);
    await this.deps.loanApplicationRepository.save(application);
    await this.deps.auditLogger.log({
      userId: reviewedByUserId,
      action: 'APPROVE_LOAN_APPLICATION',
      entityType: 'LoanApplication',
      entityId: application.id,
      previousValue: { status: previousStatus },
      newValue: { status: 'APPROVED', decisionNote },
    });

    // ADR-050: Log activity for profile timeline
    if (this.deps.profileActivityLogService) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'LOAN_APPLICATION',
        profileId: application.id,
        userId: reviewedByUserId,
        ...ProfileActivityLogService.actions.decisionUpdated(previousStatus, 'APPROVED', decisionNote),
      });
    }

    // Notification Center (2026-07-17): tell whoever encoded this application that it was decided.
    if (this.deps.notificationService && application.encodedByUserId && application.encodedByUserId !== reviewedByUserId) {
      await this.deps.notificationService.notifyUser({
        userId: application.encodedByUserId,
        branchId: application.branchId,
        type: 'APPLICATION_DECIDED',
        title: `Approved: ${application.applicantName}`,
        entityType: 'LoanApplication',
        entityId: application.id,
      });
    }

    // Easycash Portal Notification Center (2026-07-24): tell the portal applicant themself
    // (Approved/Declined only, per user's confirmed scope) via bell + email/SMS.
    // 2026-08-14 (user request): detailed title - who approved it, spelled out - the timestamp
    // itself is deliberately NOT embedded in the title text; NotificationBell already renders
    // `createdAt` as its own line under every notification, so repeating it in the title would be
    // redundant, not "more detailed".
    if (this.deps.portalNotificationService && application.portalAccountId) {
      const reviewer = this.deps.userRepository ? await this.deps.userRepository.findById(reviewedByUserId) : null;
      const reviewerName = reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : 'an Easycash loan officer';
      await this.deps.portalNotificationService.notify({
        portalAccountId: application.portalAccountId,
        type: 'APPLICATION_APPROVED',
        title: `LOAN APPLICATION APPROVED: ${application.applicantName}'s application has been approved by ${reviewerName}`,
        body: decisionNote ?? 'Your loan application has been approved. Our team will reach out to complete the release of proceeds.',
        entityType: 'LoanApplication',
        entityId: application.id,
      });
    }

    return application;
  }
}
