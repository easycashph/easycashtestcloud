import { NotFoundError } from '@shared/errors/DomainError';
import type { Money } from '@shared/domain/Money';
import type { IUnitOfWork } from '@shared/application/ports/IUnitOfWork';
import type { IFinancialAuditLogger } from '@shared/application/ports/IFinancialAuditLogger';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import { FeeAdjustment } from '../../domain/FeeAdjustment';
import type { IRepaymentInstallmentRepository } from '../ports/IRepaymentInstallmentRepository';
import type { IFeeAdjustmentRepository } from '../ports/IFeeAdjustmentRepository';

export interface AdjustFeesUseCaseDeps {
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
  loanAccountRepository: ILoanAccountRepository;
  feeAdjustmentRepository: IFeeAdjustmentRepository;
  financialAuditLogger: IFinancialAuditLogger;
  unitOfWork: IUnitOfWork;
}

/**
 * 2026-07-16 (Adjust Fees feature, user-confirmed business rules — CLAUDE.md "never invent
 * business rules," every rule here was asked, not assumed):
 * - Only Accounting/MIS may call this (enforced by the HTTP layer's `requireRole`, not here — same
 *   division of concerns as every other role-gated use case in this codebase).
 * - Bidirectional: may raise or lower the fees due, unlike `ReducePenaltyUseCase` — non-negative is
 *   the only ceiling (`RepaymentInstallment.adjustFees()`'s own validation).
 * - Cannot adjust an installment whose fees have already been paid — same already-paid rule and
 *   rationale as Reduce Penalty.
 * - Required `reason` captures the external approval reference — this system records that an
 *   adjustment was approved elsewhere, it does not run its own in-app approval workflow.
 *
 * `effectiveFeesDue` resolves entirely from the installment itself — no `LoanAccount` lookup is
 * needed for the ceiling/validation math, unlike `ReducePenaltyUseCase`'s live ADR-050 formula.
 * The `LoanAccount` is still loaded and saved here (2026-07-16 follow-up), purely to keep
 * `feesBalance`/`accountingBalance`/`collectionsBalance` in sync via `adjustFeesBalance()` — see
 * that method's doc comment for why this sync is NOT extended to penalty.
 */
export class AdjustFeesUseCase {
  constructor(private readonly deps: AdjustFeesUseCaseDeps) {}

  async execute(installmentId: string, newAmount: Money, reason: string, adjustedByUserId: string): Promise<void> {
    const installment = await this.deps.repaymentInstallmentRepository.findById(installmentId);
    if (!installment) {
      throw new NotFoundError('RepaymentInstallment', installmentId);
    }

    const loanAccount = await this.deps.loanAccountRepository.findById(installment.loanAccountId);
    if (!loanAccount) {
      throw new NotFoundError('LoanAccount', installment.loanAccountId);
    }

    const previousFees = installment.effectiveFeesDue;

    // Validation (negative / already-paid fees) lives on the entity itself — see
    // RepaymentInstallment.adjustFees()'s own doc comment.
    installment.adjustFees(newAmount, reason, adjustedByUserId);
    loanAccount.adjustFeesBalance(previousFees.subtract(newAmount));

    const adjustment = FeeAdjustment.create({
      repaymentInstallmentId: installment.id,
      previousFeesAmount: previousFees,
      newFeesAmount: newAmount,
      reason,
      adjustedByUserId,
    });

    await this.deps.unitOfWork.run(async (ctx) => {
      await this.deps.repaymentInstallmentRepository.save(installment, ctx);
      await this.deps.loanAccountRepository.save(loanAccount, ctx);
      await this.deps.feeAdjustmentRepository.create(adjustment, ctx);
      await this.deps.financialAuditLogger.log(
        {
          userId: adjustedByUserId,
          action: 'ADJUST_FEES',
          entityType: 'RepaymentInstallment',
          entityId: installment.id,
          previousValue: { fees: previousFees.toString() },
          newValue: { fees: newAmount.toString(), reason },
        },
        ctx,
      );
    });
  }
}
