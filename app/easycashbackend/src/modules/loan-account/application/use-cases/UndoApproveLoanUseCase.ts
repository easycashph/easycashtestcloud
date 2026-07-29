import { NotFoundError } from '@shared/errors/DomainError';
import type { IUnitOfWork } from '@shared/application/ports/IUnitOfWork';
import type { IFinancialAuditLogger } from '@shared/application/ports/IFinancialAuditLogger';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';

export interface UndoApproveLoanUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  financialAuditLogger: IFinancialAuditLogger;
  unitOfWork: IUnitOfWork;
  profileActivityLogService?: ProfileActivityLogService;
}

/**
 * 2026-07-16 (Undo Approve, user request): "may bigla na approved and activate tapos may bigla
 * kailangan i-adjust na amount or term" — a safety net for an accidental Approve click, MIS-only
 * (enforced by the HTTP layer's `requireRole('MIS')`, not here). Unconditionally safe per
 * `LoanAccount.undoApprove()`'s own doc comment — nothing financial has happened yet at APPROVED,
 * so unlike `UndoActivateLoanUseCase` this needs no activity guard.
 */
export class UndoApproveLoanUseCase {
  constructor(private readonly deps: UndoApproveLoanUseCaseDeps) {}

  async execute(loanAccountId: string, undoneByUserId: string): Promise<void> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) {
      throw new NotFoundError('LoanAccount', loanAccountId);
    }

    loanAccount.undoApprove();

    await this.deps.unitOfWork.run(async (ctx) => {
      await this.deps.loanAccountRepository.save(loanAccount, ctx);
      await this.deps.financialAuditLogger.log(
        {
          userId: undoneByUserId,
          action: 'UNDO_APPROVE_LOAN',
          entityType: 'LoanAccount',
          entityId: loanAccount.id,
          previousValue: { status: 'APPROVED' },
          newValue: { status: 'PENDING_APPROVAL' },
        },
        ctx,
      );
    });

    if (this.deps.profileActivityLogService) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'LOAN_ACCOUNT',
        profileId: loanAccount.id,
        userId: undoneByUserId,
        ...ProfileActivityLogService.actions.decisionUpdated('APPROVED', 'PENDING_APPROVAL'),
      });
    }
  }
}
