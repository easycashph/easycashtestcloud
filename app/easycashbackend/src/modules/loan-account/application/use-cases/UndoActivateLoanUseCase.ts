import { NotFoundError } from '@shared/errors/DomainError';
import type { IUnitOfWork } from '@shared/application/ports/IUnitOfWork';
import type { IFinancialAuditLogger } from '@shared/application/ports/IFinancialAuditLogger';
import type { ILoanTransactionRepository } from '@modules/ledger/application/ports/ILoanTransactionRepository';
import type { IRepaymentInstallmentRepository } from '@modules/repayment/application/ports/IRepaymentInstallmentRepository';
import type { IPenaltyReductionRepository } from '@modules/repayment/application/ports/IPenaltyReductionRepository';
import type { IFeeAdjustmentRepository } from '@modules/repayment/application/ports/IFeeAdjustmentRepository';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import { LoanAccountHasActivityError } from '../../domain/errors/LoanAccountDomainErrors';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';

export interface UndoActivateLoanUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
  loanTransactionRepository: ILoanTransactionRepository;
  penaltyReductionRepository: IPenaltyReductionRepository;
  feeAdjustmentRepository: IFeeAdjustmentRepository;
  financialAuditLogger: IFinancialAuditLogger;
  unitOfWork: IUnitOfWork;
  profileActivityLogService?: ProfileActivityLogService;
}

/**
 * 2026-07-16 (Undo Activate, user request, MIS-only): "may bigla na approved and activate tapos
 * may bigla kailangan i-adjust na amount or term" — a safety net for an accidental Activate click,
 * scoped narrowly to "nothing else has happened yet" (user-confirmed, not a general-purpose way to
 * unwind an active loan with real activity on it):
 *   - Refuses if any `REPAYMENT` transaction has been recorded (a real payment already happened).
 *   - Refuses if any Reduce Penalty / Adjust Fees override exists on any of this loan's
 *     installments (an audit-trail row that would otherwise reference a row this use case is
 *     about to delete).
 * Deliberately does NOT delete the original `DISBURSEMENT` `LoanTransaction` — see
 * `LoanAccount.undoActivate()`'s own doc comment for why (TXN-1, user-confirmed to stay that way).
 * Deletes this loan's `RepaymentInstallment` rows outright (safe once the above two checks pass —
 * no append-only requirement applies to a not-yet-touched installment).
 */
export class UndoActivateLoanUseCase {
  constructor(private readonly deps: UndoActivateLoanUseCaseDeps) {}

  async execute(loanAccountId: string, undoneByUserId: string): Promise<void> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) {
      throw new NotFoundError('LoanAccount', loanAccountId);
    }

    const transactions = await this.deps.loanTransactionRepository.findByLoanAccountId(loanAccountId, { limit: 50 });
    const hasRepayment = transactions.some((t) => t.type === 'REPAYMENT');
    if (hasRepayment) {
      throw new LoanAccountHasActivityError(loanAccountId, 'a payment has already been recorded against it');
    }

    const [penaltyReductions, feeAdjustments] = await Promise.all([
      this.deps.penaltyReductionRepository.findViewsByLoanAccountId(loanAccountId),
      this.deps.feeAdjustmentRepository.findViewsByLoanAccountId(loanAccountId),
    ]);
    if (penaltyReductions.length > 0 || feeAdjustments.length > 0) {
      throw new LoanAccountHasActivityError(
        loanAccountId,
        'a penalty reduction or fee adjustment has already been recorded on one of its installments',
      );
    }

    loanAccount.undoActivate();

    await this.deps.unitOfWork.run(async (ctx) => {
      await this.deps.loanAccountRepository.save(loanAccount, ctx);
      await this.deps.repaymentInstallmentRepository.deleteAllByLoanAccountId(loanAccountId, ctx);
      await this.deps.financialAuditLogger.log(
        {
          userId: undoneByUserId,
          action: 'UNDO_ACTIVATE_LOAN',
          entityType: 'LoanAccount',
          entityId: loanAccount.id,
          previousValue: { status: 'ACTIVE' },
          newValue: { status: 'APPROVED' },
        },
        ctx,
      );
    });

    if (this.deps.profileActivityLogService) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'LOAN_ACCOUNT',
        profileId: loanAccount.id,
        userId: undoneByUserId,
        ...ProfileActivityLogService.actions.decisionUpdated('ACTIVE', 'APPROVED'),
      });
    }
  }
}
