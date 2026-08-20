import { NotFoundError } from '@shared/errors/DomainError';
import type { Money } from '@shared/domain/Money';
import type { IUnitOfWork } from '@shared/application/ports/IUnitOfWork';
import type { IFinancialAuditLogger } from '@shared/application/ports/IFinancialAuditLogger';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { ILoanTransactionRepository } from '@modules/ledger/application/ports/ILoanTransactionRepository';
import { LoanTransaction } from '@modules/ledger/domain/LoanTransaction';
import { PenaltyCharge } from '../../domain/PenaltyCharge';
import { resolveEffectivePenaltyDue } from '../../domain/CurrentPenaltyResolver';
import type { IRepaymentInstallmentRepository } from '../ports/IRepaymentInstallmentRepository';
import type { IPenaltyChargeRepository } from '../ports/IPenaltyChargeRepository';

export interface AddPenaltyUseCaseDeps {
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
  loanAccountRepository: ILoanAccountRepository;
  loanTransactionRepository: ILoanTransactionRepository;
  penaltyChargeRepository: IPenaltyChargeRepository;
  financialAuditLogger: IFinancialAuditLogger;
  unitOfWork: IUnitOfWork;
}

/**
 * 2026-08-19 (Add Penalty feature, user-confirmed business rules): built for the migration period,
 * while SDevTech remains the source of truth and this system's own live ADR-050 penalty
 * auto-computation is disabled (`PENALTY_AUTO_COMPUTE_ENABLED=false` — see
 * `CurrentPenaltyResolver.resolveComputedPenalty()`'s own doc comment). Staff manually key in
 * whatever penalty SDevTech's own screen currently shows for a loan, exactly the way `AddFeeUseCase`
 * exists for the same reason on the fees side — mirrors that use case's shape as closely as
 * possible.
 * - MIS/Accounting only (enforced by the HTTP layer, not here — same division of concerns as every
 *   other role-gated use case in this codebase).
 * - `amount` is a staff-entered fixed figure — additive, always positive (see
 *   `RepaymentInstallment.chargePenalty()`'s own doc comment).
 * - Per-installment. Unlike `ReducePenaltyUseCase`, NOT blocked by an already-paid penalty
 *   component — a prior penalty being fully settled has no bearing on whether a brand new one may
 *   be charged now.
 *
 * Also creates a real `PENALTY_APPLIED` `LoanTransaction`, since a charge is a genuine financial
 * event (TXN-1: no balance change without a corresponding transaction row) — same reasoning as
 * `AddFeeUseCase`'s `FEE_CHARGED` transaction.
 */
export class AddPenaltyUseCase {
  constructor(private readonly deps: AddPenaltyUseCaseDeps) {}

  async execute(installmentId: string, amount: Money, reason: string, chargedByUserId: string, chargedAt: Date = new Date()): Promise<void> {
    const installment = await this.deps.repaymentInstallmentRepository.findById(installmentId);
    if (!installment) {
      throw new NotFoundError('RepaymentInstallment', installmentId);
    }

    const loanAccount = await this.deps.loanAccountRepository.findById(installment.loanAccountId);
    if (!loanAccount) {
      throw new NotFoundError('LoanAccount', installment.loanAccountId);
    }

    const previousPenaltyDue = resolveEffectivePenaltyDue(installment);

    // Validation (must be positive) lives on the entity itself — see
    // RepaymentInstallment.chargePenalty()'s own doc comment.
    installment.chargePenalty(amount, reason, chargedByUserId, chargedAt);
    const newPenaltyDue = resolveEffectivePenaltyDue(installment);

    // Same helper ReducePenaltyUseCase uses to keep LoanAccount.balances in sync - delta is
    // (previous - new), which here is always -amount (negative), so subtracting it increases
    // penaltyBalance/penaltyDue by exactly the charged amount.
    loanAccount.adjustPenaltyBalance(previousPenaltyDue.subtract(newPenaltyDue));

    const transaction = LoanTransaction.create({
      loanAccountId: loanAccount.id,
      type: 'PENALTY_APPLIED',
      amount,
      components: { penaltyComponent: amount },
      balanceAfter: loanAccount.balances.principalBalance,
      postedByUserId: chargedByUserId,
      branchId: loanAccount.branchId,
      entryDate: chargedAt,
      comment: reason,
    });

    const charge = PenaltyCharge.create({
      repaymentInstallmentId: installment.id,
      loanTransactionId: transaction.id,
      previousPenaltyAmount: previousPenaltyDue,
      newPenaltyAmount: newPenaltyDue,
      reason,
      chargedByUserId,
    });

    await this.deps.unitOfWork.run(async (ctx) => {
      await this.deps.repaymentInstallmentRepository.save(installment, ctx);
      await this.deps.loanAccountRepository.save(loanAccount, ctx);
      await this.deps.loanTransactionRepository.create(transaction, ctx);
      await this.deps.penaltyChargeRepository.create(charge, ctx);
      await this.deps.financialAuditLogger.log(
        {
          userId: chargedByUserId,
          action: 'CHARGE_PENALTY',
          entityType: 'RepaymentInstallment',
          entityId: installment.id,
          previousValue: { penaltyDue: previousPenaltyDue.toString() },
          newValue: { penaltyDue: newPenaltyDue.toString(), amountCharged: amount.toString(), reason },
        },
        ctx,
      );
    });
  }
}
