import { NotFoundError } from '@shared/errors/DomainError';
import type { IUnitOfWork } from '@shared/application/ports/IUnitOfWork';
import type { IFinancialAuditLogger } from '@shared/application/ports/IFinancialAuditLogger';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';

export interface RejectLoanUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  financialAuditLogger: IFinancialAuditLogger;
  unitOfWork: IUnitOfWork;
  profileActivityLogService?: ProfileActivityLogService;
}

/**
 * 2026-07-08 (M-8 fix): same rationale as `ApproveLoanUseCase` — a human
 * rejecting a loan is a money-movement-authority decision that
 * `FINANCIAL_INVARIANTS.md §4`'s fail-closed audit rule applies to, so the
 * save + audit-log write are now wrapped in one `IUnitOfWork.run()` block.
 */
export class RejectLoanUseCase {
  constructor(private readonly deps: RejectLoanUseCaseDeps) {}

  async execute(loanAccountId: string, rejectedByUserId: string, reason?: string): Promise<void> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) {
      throw new NotFoundError('LoanAccount', loanAccountId);
    }

    loanAccount.reject(reason);

    await this.deps.unitOfWork.run(async (ctx) => {
      await this.deps.loanAccountRepository.save(loanAccount, ctx);
      await this.deps.financialAuditLogger.log(
        {
          userId: rejectedByUserId,
          action: 'REJECT_LOAN',
          entityType: 'LoanAccount',
          entityId: loanAccount.id,
          previousValue: { status: 'PENDING_APPROVAL' },
          newValue: { status: 'CLOSED_REJECTED', reason: reason ?? null },
        },
        ctx,
      );
    });

    // ADR-050: Log activity for profile timeline
    if (this.deps.profileActivityLogService) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'LOAN_ACCOUNT',
        profileId: loanAccount.id,
        userId: rejectedByUserId,
        ...ProfileActivityLogService.actions.decisionUpdated('PENDING_APPROVAL', 'CLOSED_REJECTED', reason),
      });
    }
  }
}
