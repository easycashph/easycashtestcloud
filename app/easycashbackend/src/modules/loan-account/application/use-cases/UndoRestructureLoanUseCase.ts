import { NotFoundError } from '@shared/errors/DomainError';
import type { IUnitOfWork } from '@shared/application/ports/IUnitOfWork';
import type { IFinancialAuditLogger } from '@shared/application/ports/IFinancialAuditLogger';
import type { ILoanTransactionRepository } from '@modules/ledger/application/ports/ILoanTransactionRepository';
import type { IRepaymentInstallmentRepository } from '@modules/repayment/application/ports/IRepaymentInstallmentRepository';
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
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
  penaltyReductionRepository: IPenaltyReductionRepository;
  feeAdjustmentRepository: IFeeAdjustmentRepository;
  financialAuditLogger: IFinancialAuditLogger;
  unitOfWork: IUnitOfWork;
  profileActivityLogService?: ProfileActivityLogService;
}

/**
 * 2026-08-08 (Undo Restructure feature, user-confirmed, permission-gated -
 * `loan_account.undo_restructure`, independently grantable per role, not tied to MIS or to
 * whichever permission performs the restructure itself): undoes `RestructureLoanUseCase` for a
 * given OLD loan account - same "safety net for an accidental/premature action, not a
 * general-purpose unwind" posture `UndoActivateLoanUseCase` already established:
 *   - Refuses if the NEW loan (the one the restructure created) already has a `REPAYMENT`
 *     transaction, or a Reduce Penalty / Adjust Fees override on any of its installments.
 *   - Refuses if the loan was never restructured, or its restructure was already undone
 *     (the row no longer exists once undone - see below).
 * Mechanically: `oldLoanAccount.undoRestructureClose()` (-> ACTIVE) on the old loan, then - once
 * confirmed the new loan has no real activity - deletes the new loan's `RepaymentInstallment` and
 * `LoanTransaction` rows, the `LoanRestructure` row itself, and finally the new `LoanAccount` row.
 * User-confirmed revision (2026-08-08): a reverted restructure leaves no trace, rather than being
 * retired/marked-undone - the old loan can be restructured again afterward as if the first one had
 * never happened.
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

    await this.deps.unitOfWork.run(async (ctx) => {
      await this.deps.loanAccountRepository.save(oldLoanAccount, ctx);
      await this.deps.repaymentInstallmentRepository.deleteAllByLoanAccountId(newLoanAccount.id, ctx);
      await this.deps.loanTransactionRepository.deleteAllByLoanAccountId(newLoanAccount.id, ctx);
      await this.deps.loanRestructureRepository.delete(restructure.id, ctx);
      await this.deps.loanAccountRepository.delete(newLoanAccount.id, ctx);
      await this.deps.financialAuditLogger.log(
        {
          userId: undoneByUserId,
          action: 'UNDO_RESTRUCTURE_LOAN',
          entityType: 'LoanAccount',
          entityId: oldLoanAccount.id,
          previousValue: { status: 'CLOSED_RESTRUCTURED', newLoanAccountId: newLoanAccount.id },
          newValue: { status: 'ACTIVE', newLoanAccountDeleted: newLoanAccount.id },
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
