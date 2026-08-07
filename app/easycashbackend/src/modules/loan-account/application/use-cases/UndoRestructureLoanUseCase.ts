import { NotFoundError } from '@shared/errors/DomainError';
import type { IUnitOfWork } from '@shared/application/ports/IUnitOfWork';
import type { IFinancialAuditLogger } from '@shared/application/ports/IFinancialAuditLogger';
import type { ILoanTransactionRepository } from '@modules/ledger/application/ports/ILoanTransactionRepository';
import type { IPenaltyReductionRepository } from '@modules/repayment/application/ports/IPenaltyReductionRepository';
import type { IFeeAdjustmentRepository } from '@modules/repayment/application/ports/IFeeAdjustmentRepository';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import { NewLoanAccountHasActivityError, LoanNotRestructuredError } from '../../domain/errors/LoanAccountDomainErrors';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';
import type { ILoanRestructureRepository } from '../ports/ILoanRestructureRepository';

export interface UndoRestructureLoanUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  loanRestructureRepository: ILoanRestructureRepository;
  loanTransactionRepository: ILoanTransactionRepository;
  penaltyReductionRepository: IPenaltyReductionRepository;
  feeAdjustmentRepository: IFeeAdjustmentRepository;
  financialAuditLogger: IFinancialAuditLogger;
  unitOfWork: IUnitOfWork;
  profileActivityLogService?: ProfileActivityLogService;
}

/**
 * 2026-08-07 (Undo Restructure feature, user-confirmed, permission-gated -
 * `loan_account.undo_restructure`, independently grantable per role, not tied to MIS or to
 * whichever permission performs the restructure itself): undoes `RestructureLoanUseCase` for a
 * given OLD loan account - same "safety net for an accidental/premature action, not a
 * general-purpose unwind" posture `UndoActivateLoanUseCase` already established:
 *   - Refuses if the NEW loan (the one the restructure created) already has a `REPAYMENT`
 *     transaction, or a Reduce Penalty / Adjust Fees override on any of its installments.
 *   - Refuses if the loan was never restructured, or its restructure was already undone
 *     (`ILoanRestructureRepository.findByOldLoanAccountId` only returns an ACTIVE, not-yet-undone
 *     row - see that method's own doc comment).
 * Mechanically: `oldLoanAccount.undoRestructureClose()` (-> ACTIVE), `newLoanAccount.markUndone()`
 * (-> CLOSED_UNDONE, retired not deleted), `LoanRestructure.markUndone()` (the row itself is never
 * deleted - see that entity's own doc comment). Deliberately does NOT delete the new loan's
 * `RepaymentInstallment` rows or `DISBURSEMENT` `LoanTransaction` - same "financial records are
 * never deleted" posture `UndoActivateLoanUseCase` already established for its own case.
 */
export class UndoRestructureLoanUseCase {
  constructor(private readonly deps: UndoRestructureLoanUseCaseDeps) {}

  async execute(oldLoanAccountId: string, undoneByUserId: string): Promise<void> {
    const oldLoanAccount = await this.deps.loanAccountRepository.findById(oldLoanAccountId);
    if (!oldLoanAccount) {
      throw new NotFoundError('LoanAccount', oldLoanAccountId);
    }

    const restructure = await this.deps.loanRestructureRepository.findByOldLoanAccountId(oldLoanAccountId);
    if (!restructure) {
      throw new LoanNotRestructuredError(oldLoanAccountId);
    }

    const newLoanAccount = await this.deps.loanAccountRepository.findById(restructure.newLoanAccountId);
    if (!newLoanAccount) {
      throw new NotFoundError('LoanAccount', restructure.newLoanAccountId);
    }

    const transactions = await this.deps.loanTransactionRepository.findByLoanAccountId(newLoanAccount.id, { limit: 50 });
    const hasRepayment = transactions.some((t) => t.type === 'REPAYMENT');
    if (hasRepayment) {
      throw new NewLoanAccountHasActivityError(newLoanAccount.id, 'already has a payment recorded against it');
    }

    const [penaltyReductions, feeAdjustments] = await Promise.all([
      this.deps.penaltyReductionRepository.findViewsByLoanAccountId(newLoanAccount.id),
      this.deps.feeAdjustmentRepository.findViewsByLoanAccountId(newLoanAccount.id),
    ]);
    if (penaltyReductions.length > 0 || feeAdjustments.length > 0) {
      throw new NewLoanAccountHasActivityError(newLoanAccount.id, 'already has a penalty reduction or fee adjustment on one of its installments');
    }

    oldLoanAccount.undoRestructureClose();
    newLoanAccount.markUndone();
    restructure.markUndone(undoneByUserId);

    await this.deps.unitOfWork.run(async (ctx) => {
      await this.deps.loanAccountRepository.save(oldLoanAccount, ctx);
      await this.deps.loanAccountRepository.save(newLoanAccount, ctx);
      await this.deps.loanRestructureRepository.update(restructure, ctx);
      await this.deps.financialAuditLogger.log(
        {
          userId: undoneByUserId,
          action: 'UNDO_RESTRUCTURE_LOAN',
          entityType: 'LoanAccount',
          entityId: oldLoanAccount.id,
          previousValue: { status: 'CLOSED_RESTRUCTURED', newLoanAccountId: newLoanAccount.id },
          newValue: { status: 'ACTIVE', newLoanAccountStatus: 'CLOSED_UNDONE' },
        },
        ctx,
      );
    });

    if (this.deps.profileActivityLogService) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'LOAN_ACCOUNT',
        profileId: oldLoanAccount.id,
        userId: undoneByUserId,
        ...ProfileActivityLogService.actions.decisionUpdated('CLOSED_RESTRUCTURED', 'ACTIVE'),
      });
    }
  }
}
