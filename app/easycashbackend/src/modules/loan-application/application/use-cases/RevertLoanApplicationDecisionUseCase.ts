import { NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';
import type { LoanApplicationPreQualificationService } from '../services/LoanApplicationPreQualificationService';

export interface RevertLoanApplicationDecisionUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  auditLogger: IAuditLogger;
  preQualificationService: LoanApplicationPreQualificationService;
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

    application.revert(classification.status);
    await this.deps.loanApplicationRepository.save(application);
    await this.deps.auditLogger.log({
      userId: revertedByUserId,
      action: 'REVERT_LOAN_APPLICATION_DECISION',
      entityType: 'LoanApplication',
      entityId: application.id,
      previousValue: { status: previousStatus },
      newValue: { status: classification.status },
    });

    // ADR-050: Log activity for profile timeline
    if (this.deps.profileActivityLogService) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'LOAN_APPLICATION',
        profileId: application.id,
        userId: revertedByUserId,
        ...ProfileActivityLogService.actions.decisionUpdated(previousStatus, classification.status, 'Decision reverted to pending'),
      });
    }

    return application;
  }
}
