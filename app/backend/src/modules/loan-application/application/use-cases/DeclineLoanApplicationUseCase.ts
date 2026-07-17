import { NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { NotificationService } from '@modules/notification/application/NotificationService';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';

export interface DeclineLoanApplicationUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  auditLogger: IAuditLogger;
  profileActivityLogService?: ProfileActivityLogService;
  notificationService?: NotificationService;
}

export class DeclineLoanApplicationUseCase {
  constructor(private readonly deps: DeclineLoanApplicationUseCaseDeps) {}

  async execute(id: string, reviewedByUserId: string, decisionNote: string | undefined): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) {
      throw new NotFoundError('LoanApplication', id);
    }

    const previousStatus = application.status;
    application.decline(reviewedByUserId, decisionNote);
    await this.deps.loanApplicationRepository.save(application);
    await this.deps.auditLogger.log({
      userId: reviewedByUserId,
      action: 'DECLINE_LOAN_APPLICATION',
      entityType: 'LoanApplication',
      entityId: application.id,
      previousValue: { status: previousStatus },
      newValue: { status: 'DECLINED', decisionNote },
    });

    // ADR-050: Log activity for profile timeline
    if (this.deps.profileActivityLogService) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'LOAN_APPLICATION',
        profileId: application.id,
        userId: reviewedByUserId,
        ...ProfileActivityLogService.actions.decisionUpdated(previousStatus, 'DECLINED', decisionNote),
      });
    }

    // Notification Center (2026-07-17): tell whoever encoded this application that it was decided.
    if (this.deps.notificationService && application.encodedByUserId && application.encodedByUserId !== reviewedByUserId) {
      await this.deps.notificationService.notifyUser({
        userId: application.encodedByUserId,
        branchId: application.branchId,
        type: 'APPLICATION_DECIDED',
        title: `Declined: ${application.applicantName}`,
        entityType: 'LoanApplication',
        entityId: application.id,
      });
    }

    return application;
  }
}
