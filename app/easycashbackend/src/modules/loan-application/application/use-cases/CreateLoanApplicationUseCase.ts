import { LoanApplication } from '../../domain/LoanApplication';
import { BorrowerHasInFlightLoanError } from '../../domain/errors/LoanApplicationDomainErrors';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { NotificationService } from '@modules/notification/application/NotificationService';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';
import type { CreateLoanApplicationInput } from '../dtos/LoanApplicationDtos';
import type { LoanApplicationPreQualificationService } from '../services/LoanApplicationPreQualificationService';

const CLOSED_LOAN_ACCOUNT_STATUSES = new Set(['CLOSED', 'CLOSED_WRITTEN_OFF', 'CLOSED_REJECTED', 'CLOSED_RESTRUCTURED', 'CLOSED_ADJUSTED']);

/** Reviewer roles for a freshly-submitted application - mirrors the frontend's `canReviewLoanApplication`. */
const APPLICATION_SUBMITTED_NOTIFY_ROLES = ['MIS', 'Loan Operation Manager', 'CRM'];

export interface CreateLoanApplicationUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
  preQualificationService: LoanApplicationPreQualificationService;
  profileActivityLogService?: ProfileActivityLogService;
  /** Only needed to enforce the one-application-at-a-time rule below - undefined for callers that
   * don't set `input.borrowerId` (the original walk-in intake flow has no borrower yet). */
  loanAccountRepository?: ILoanAccountRepository;
  notificationService?: NotificationService;
}

export class CreateLoanApplicationUseCase {
  constructor(private readonly deps: CreateLoanApplicationUseCaseDeps) {}

  async execute(input: CreateLoanApplicationInput): Promise<LoanApplication> {
    // 2026-07-14: a client cannot have two loan applications going at once, nor start a new one
    // ("Create Loan Application" renewal flow) while an earlier one is anything other than
    // DECLINED and hasn't yet produced a loan account. Only checked when `borrowerId` is set - the
    // original walk-in intake flow (no existing client yet) can't collide with anything.
    //
    // "Hasn't yet produced a loan account" has no precise per-application tracking today (no FK
    // from LoanAccount back to the LoanApplication it came from) - approximated the same way the
    // frontend's own eligibility check does: once the borrower has ANY loan account at all, their
    // earlier applications are treated as resolved/converted, and the separate "active loan still
    // open" check below is what actually gates a further renewal from that point on.
    if (input.borrowerId) {
      const [existingApplications, existingLoans] = await Promise.all([
        this.deps.loanApplicationRepository.findByBorrowerId(input.borrowerId),
        this.deps.loanAccountRepository?.findMany({ borrowerId: input.borrowerId, limit: 1000 }) ?? Promise.resolve([]),
      ]);

      const hasPendingApplication = existingApplications.some((app) => app.status !== 'DECLINED') && existingLoans.length === 0;
      if (hasPendingApplication) throw new BorrowerHasInFlightLoanError('PENDING_APPLICATION');

      const hasActiveLoan = existingLoans.some((loan) => !CLOSED_LOAN_ACCOUNT_STATUSES.has(loan.status));
      if (hasActiveLoan) throw new BorrowerHasInFlightLoanError('ACTIVE_LOAN');
    } else if (input.portalAccountId) {
      // 2026-07-24 (user request): the same "one in-flight application at a time" rule as above,
      // for an Easycash Portal client who hasn't been converted into a real Borrower yet (no
      // borrowerId). There's no LoanAccount to check yet at this stage - a portal-only applicant
      // can't have one until staff runs "Create Client Profile" on an APPROVED application, which
      // is exactly when `borrowerId` starts being set and the branch above takes over instead.
      // Re-submission is allowed only once every prior application for this account is DECLINED.
      const existingApplications = await this.deps.loanApplicationRepository.findByPortalAccountId(input.portalAccountId);
      const hasPendingApplication = existingApplications.some((app) => app.status !== 'DECLINED');
      if (hasPendingApplication) throw new BorrowerHasInFlightLoanError('PENDING_APPLICATION');
    }

    const classification = await this.deps.preQualificationService.classify({
      branchId: input.branchId,
      age: input.age,
      monthlyIncome: input.monthlyIncome,
      requestedAmount: input.requestedAmount,
      requestedTermMonths: input.requestedTermMonths,
      requestedCategory: input.requestedCategory,
      applicantAddressText: input.address,
    });

    const application = LoanApplication.create({
      ...input,
      status: classification.status,
      distanceFromBranchKm: classification.distanceFromBranchKm ?? undefined,
    });
    await this.deps.loanApplicationRepository.save(application);

    // ADR-050: Log activity for profile timeline
    if (this.deps.profileActivityLogService && input.encodedByUserId) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'LOAN_APPLICATION',
        profileId: application.id,
        userId: input.encodedByUserId,
        action: 'profile_created',
        details: {},
      });
    }

    // Notification Center (2026-07-17): tell reviewers a new application needs their attention.
    if (this.deps.notificationService) {
      await this.deps.notificationService.notifyRoles({
        roleNames: APPLICATION_SUBMITTED_NOTIFY_ROLES,
        branchId: application.branchId,
        type: 'APPLICATION_SUBMITTED',
        title: `New loan application: ${input.applicantName}`,
        body: `${input.requestedCategory} - ${input.requestedAmount}`,
        entityType: 'LoanApplication',
        entityId: application.id,
        excludeUserId: input.encodedByUserId,
      });
    }

    return application;
  }
}
