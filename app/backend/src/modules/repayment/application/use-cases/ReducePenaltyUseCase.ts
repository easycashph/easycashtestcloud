import { NotFoundError } from '@shared/errors/DomainError';
import type { Money } from '@shared/domain/Money';
import type { IUnitOfWork } from '@shared/application/ports/IUnitOfWork';
import type { IFinancialAuditLogger } from '@shared/application/ports/IFinancialAuditLogger';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import { resolveSecMc3Coverage } from '@modules/loan-account/application/services/SecMc3CoverageResolver';
import type { ILoanProductRepository } from '@modules/loan-product/application/ports/ILoanProductRepository';
import { resolveComputedPenalty, resolveEffectivePenaltyDue } from '../../domain/CurrentPenaltyResolver';
import { PenaltyReduction } from '../../domain/PenaltyReduction';
import type { IRepaymentInstallmentRepository } from '../ports/IRepaymentInstallmentRepository';
import type { IPenaltyReductionRepository } from '../ports/IPenaltyReductionRepository';

export interface ReducePenaltyUseCaseDeps {
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
  loanAccountRepository: ILoanAccountRepository;
  /** ADR-053: only needed to resolve the SEC MC 3 coverage ceiling for the reduction's validation amount. */
  loanProductRepository: ILoanProductRepository;
  penaltyReductionRepository: IPenaltyReductionRepository;
  financialAuditLogger: IFinancialAuditLogger;
  unitOfWork: IUnitOfWork;
}

/**
 * 2026-07-15 (Reduce Penalty feature, user-confirmed business rules — CLAUDE.md "never invent
 * business rules," every rule here was asked, not assumed):
 * - Only Accounting/MIS may call this (enforced by the HTTP layer's `requireRole`, not here —
 *   same division of concerns as every other role-gated use case in this codebase).
 * - 2026-07-23 (Adjust Penalty, user-confirmed): may raise OR lower the penalty, never below ₱0 and
 *   never above the live ADR-050/SEC-MC3 ceiling (`RepaymentInstallment.reducePenalty()`'s own
 *   validation) — previously reduce-only, now bidirectional like `AdjustFeesUseCase`.
 * - A reduction FREEZES the penalty; it does not resume growing per ADR-050's daily formula.
 * - Cannot reduce an installment whose penalty has already been paid — approval happens outside
 *   this system; an already-collected amount is a refund/credit decision, explicitly out of scope.
 * - Required `reason` captures the external approval reference — this system records that a
 *   reduction was approved elsewhere, it does not run its own in-app approval workflow.
 *
 * 2026-07-16 follow-up: also keeps `LoanAccount.balances.penaltyBalance`/`penaltyDue` in sync
 * (`adjustPenaltyBalance()`), mirroring `AdjustFeesUseCase`'s balance sync. The delta is computed
 * against `resolveEffectivePenaltyDue()` (override-or-frozen-`due.penalty`), NOT `currentPenalty`
 * (the live ADR-050 ceiling used for validation above) — see `adjustPenaltyBalance()`'s own doc
 * comment for why those two must not be conflated.
 */
export class ReducePenaltyUseCase {
  constructor(private readonly deps: ReducePenaltyUseCaseDeps) {}

  async execute(installmentId: string, newAmount: Money, reason: string, reducedByUserId: string): Promise<void> {
    const installment = await this.deps.repaymentInstallmentRepository.findById(installmentId);
    if (!installment) {
      throw new NotFoundError('RepaymentInstallment', installmentId);
    }

    const loanAccount = await this.deps.loanAccountRepository.findById(installment.loanAccountId);
    if (!loanAccount) {
      throw new NotFoundError('LoanAccount', installment.loanAccountId);
    }

    const scheduleInstallments = await this.deps.repaymentInstallmentRepository.findByLoanAccountId(loanAccount.id);
    const maturityDate = scheduleInstallments.reduce(
      (latest, i) => (i.dueDate > latest ? i.dueDate : latest),
      scheduleInstallments[0]?.dueDate ?? installment.dueDate,
    );
    const currentPenalty = resolveComputedPenalty(installment, {
      isProspectiveLoan: !loanAccount.legacyId,
      principalAmount: loanAccount.principalAmount,
      isSecMc3Covered: await resolveSecMc3Coverage(loanAccount, this.deps.loanProductRepository),
      maturityDate,
    });

    const previousBalanceTrackedPenalty = resolveEffectivePenaltyDue(installment);

    // Validation (negative / exceeds current / already-paid penalty) lives on the entity itself —
    // see RepaymentInstallment.reducePenalty()'s own doc comment.
    installment.reducePenalty(newAmount, currentPenalty, reason, reducedByUserId);
    loanAccount.adjustPenaltyBalance(previousBalanceTrackedPenalty.subtract(newAmount));

    const reduction = PenaltyReduction.create({
      repaymentInstallmentId: installment.id,
      previousPenaltyAmount: currentPenalty,
      newPenaltyAmount: newAmount,
      reason,
      reducedByUserId,
    });

    await this.deps.unitOfWork.run(async (ctx) => {
      await this.deps.repaymentInstallmentRepository.save(installment, ctx);
      await this.deps.loanAccountRepository.save(loanAccount, ctx);
      await this.deps.penaltyReductionRepository.create(reduction, ctx);
      await this.deps.financialAuditLogger.log(
        {
          userId: reducedByUserId,
          action: 'REDUCE_PENALTY',
          entityType: 'RepaymentInstallment',
          entityId: installment.id,
          previousValue: { penalty: currentPenalty.toString() },
          newValue: { penalty: newAmount.toString(), reason },
        },
        ctx,
      );
    });
  }
}
