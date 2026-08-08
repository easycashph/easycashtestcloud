import { NotFoundError } from '@shared/errors/DomainError';
import type { IUnitOfWork } from '@shared/application/ports/IUnitOfWork';
import type { IFinancialAuditLogger } from '@shared/application/ports/IFinancialAuditLogger';
import type { ILoanTransactionRepository } from '@modules/ledger/application/ports/ILoanTransactionRepository';
import type { IRepaymentInstallmentRepository } from '@modules/repayment/application/ports/IRepaymentInstallmentRepository';
import type { IPenaltyReductionRepository } from '@modules/repayment/application/ports/IPenaltyReductionRepository';
import type { IFeeAdjustmentRepository } from '@modules/repayment/application/ports/IFeeAdjustmentRepository';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import { NewLoanAccountHasActivityError, LoanNotAdjustedError } from '../../domain/errors/LoanAccountDomainErrors';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';
import type { ILoanAdjustmentRepository } from '../ports/ILoanAdjustmentRepository';

export interface UndoAdjustLoanUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  loanAdjustmentRepository: ILoanAdjustmentRepository;
  loanTransactionRepository: ILoanTransactionRepository;
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
  penaltyReductionRepository: IPenaltyReductionRepository;
  feeAdjustmentRepository: IFeeAdjustmentRepository;
  financialAuditLogger: IFinancialAuditLogger;
  unitOfWork: IUnitOfWork;
  profileActivityLogService?: ProfileActivityLogService;
}

/**
 * 2026-08-08 (Undo Adjustment feature, user-confirmed, permission-gated -
 * `loan_account.undo_adjust`, independently grantable per role): same shape as
 * `UndoRestructureLoanUseCase` (see that use case's own doc comment for the full reasoning) -
 * undoes `AdjustLoanUseCase` for a given OLD loan account, refusing if the NEW loan already has a
 * `REPAYMENT` transaction or a penalty/fee override, or if the loan was never adjusted / its
 * adjustment was already undone. Deletes the new loan account, its `RepaymentInstallment`/
 * `LoanTransaction` rows, and the `LoanAdjustment` row itself outright - leaves no trace, per the
 * user-confirmed 2026-08-08 revision.
 */
export class UndoAdjustLoanUseCase {
  constructor(private readonly deps: UndoAdjustLoanUseCaseDeps) {}

  async execute(oldLoanAccountId: string, undoneByUserId: string): Promise<void> {
    const oldLoanAccount = await this.deps.loanAccountRepository.findById(oldLoanAccountId);
    if (!oldLoanAccount) {
      throw new NotFoundError('LoanAccount', oldLoanAccountId);
    }

    const adjustment = await this.deps.loanAdjustmentRepository.findByOldLoanAccountId(oldLoanAccountId);
    if (!adjustment) {
      throw new LoanNotAdjustedError(oldLoanAccountId);
    }

    const newLoanAccount = await this.deps.loanAccountRepository.findById(adjustment.newLoanAccountId);
    if (!newLoanAccount) {
      throw new NotFoundError('LoanAccount', adjustment.newLoanAccountId);
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

    oldLoanAccount.undoAdjustClose();

    await this.deps.unitOfWork.run(async (ctx) => {
      await this.deps.loanAccountRepository.save(oldLoanAccount, ctx);
      await this.deps.repaymentInstallmentRepository.deleteAllByLoanAccountId(newLoanAccount.id, ctx);
      await this.deps.loanTransactionRepository.deleteAllByLoanAccountId(newLoanAccount.id, ctx);
      await this.deps.loanAdjustmentRepository.delete(adjustment.id, ctx);
      await this.deps.loanAccountRepository.delete(newLoanAccount.id, ctx);
      await this.deps.financialAuditLogger.log(
        {
          userId: undoneByUserId,
          action: 'UNDO_ADJUST_LOAN',
          entityType: 'LoanAccount',
          entityId: oldLoanAccount.id,
          previousValue: { status: 'CLOSED_ADJUSTED', newLoanAccountId: newLoanAccount.id },
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
        ...ProfileActivityLogService.actions.decisionUpdated('CLOSED_ADJUSTED', 'ACTIVE'),
      });
    }
  }
}
