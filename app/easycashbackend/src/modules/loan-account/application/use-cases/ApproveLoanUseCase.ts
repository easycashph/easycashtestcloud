import { NotFoundError } from '@shared/errors/DomainError';
import type { IUnitOfWork } from '@shared/application/ports/IUnitOfWork';
import type { IFinancialAuditLogger } from '@shared/application/ports/IFinancialAuditLogger';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';

export interface ApproveLoanUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  financialAuditLogger: IFinancialAuditLogger;
  unitOfWork: IUnitOfWork;
  profileActivityLogService?: ProfileActivityLogService;
}

/**
 * ADR-032: approval and activation/disbursement are separate business
 * events — this use case performs ONLY the PENDING_APPROVAL -> APPROVED
 * status transition. It does not create a LoanTransaction, does not
 * generate a RepaymentInstallment schedule, and does not touch any
 * balance field. `ActivateLoanUseCase` is responsible for those.
 *
 * 2026-07-08 (M-8 fix): a human approving a loan is a money-movement-
 * authority decision — `FINANCIAL_INVARIANTS.md §4`'s fail-closed,
 * same-transaction audit-write rule applies to it the same as any other
 * financial-write use case, so this now wraps the save + audit-log write in
 * one `IUnitOfWork.run()` block, mirroring `ActivateLoanUseCase`'s shape.
 * (Previously deferred pending the `audit` module's infrastructure, which
 * has existed and been wired into other use cases since CP2/CP8 — this was
 * simply never revisited for `approve`/`reject`.)
 */
export class ApproveLoanUseCase {
  constructor(private readonly deps: ApproveLoanUseCaseDeps) {}

  async execute(loanAccountId: string, approvedByUserId: string): Promise<void> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) {
      throw new NotFoundError('LoanAccount', loanAccountId);
    }

    loanAccount.approve(approvedByUserId);

    await this.deps.unitOfWork.run(async (ctx) => {
      await this.deps.loanAccountRepository.save(loanAccount, ctx);
      await this.deps.financialAuditLogger.log(
        {
          userId: approvedByUserId,
          action: 'APPROVE_LOAN',
          entityType: 'LoanAccount',
          entityId: loanAccount.id,
          previousValue: { status: 'PENDING_APPROVAL' },
          newValue: { status: 'APPROVED' },
        },
        ctx,
      );
    });

    // ADR-050: Log activity for profile timeline
    if (this.deps.profileActivityLogService) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'LOAN_ACCOUNT',
        profileId: loanAccount.id,
        userId: approvedByUserId,
        ...ProfileActivityLogService.actions.decisionUpdated('PENDING_APPROVAL', 'APPROVED'),
      });
    }
  }
}
