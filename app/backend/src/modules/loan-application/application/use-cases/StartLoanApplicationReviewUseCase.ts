import { NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';

export interface StartLoanApplicationReviewUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  auditLogger: IAuditLogger;
  profileActivityLogService?: ProfileActivityLogService;
}

/** "Start Review": PREAPPROVED -> UNDER_REVIEW. Same load/mutate/save/audit/activity-log shape as
 * ApproveLoanApplicationUseCase. */
export class StartLoanApplicationReviewUseCase {
  constructor(private readonly deps: StartLoanApplicationReviewUseCaseDeps) {}

  async execute(id: string, startedByUserId: string): Promise<LoanApplication> {
    const application = await this.deps.loanApplicationRepository.findById(id);
    if (!application) {
      throw new NotFoundError('LoanApplication', id);
    }

    const previousStatus = application.status;
    application.startReview(startedByUserId);
    await this.deps.loanApplicationRepository.save(application);
    await this.deps.auditLogger.log({
      userId: startedByUserId,
      action: 'START_LOAN_APPLICATION_REVIEW',
      entityType: 'LoanApplication',
      entityId: application.id,
      previousValue: { status: previousStatus },
      newValue: { status: 'UNDER_REVIEW' },
    });

    if (this.deps.profileActivityLogService) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'LOAN_APPLICATION',
        profileId: application.id,
        userId: startedByUserId,
        ...ProfileActivityLogService.actions.decisionUpdated(previousStatus, 'UNDER_REVIEW'),
      });
    }

    return application;
  }
}
