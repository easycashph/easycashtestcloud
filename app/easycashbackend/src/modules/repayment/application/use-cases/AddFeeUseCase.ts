import { NotFoundError } from '@shared/errors/DomainError';
import type { Money } from '@shared/domain/Money';
import type { IUnitOfWork } from '@shared/application/ports/IUnitOfWork';
import type { IFinancialAuditLogger } from '@shared/application/ports/IFinancialAuditLogger';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { ILoanTransactionRepository } from '@modules/ledger/application/ports/ILoanTransactionRepository';
import { LoanTransaction } from '@modules/ledger/domain/LoanTransaction';
import { FeeCharge } from '../../domain/FeeCharge';
import type { IRepaymentInstallmentRepository } from '../ports/IRepaymentInstallmentRepository';
import type { IFeeChargeRepository } from '../ports/IFeeChargeRepository';

export interface AddFeeUseCaseDeps {
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
  loanAccountRepository: ILoanAccountRepository;
  loanTransactionRepository: ILoanTransactionRepository;
  feeChargeRepository: IFeeChargeRepository;
  financialAuditLogger: IFinancialAuditLogger;
  unitOfWork: IUnitOfWork;
}

/**
 * 2026-08-15 (Add Fee feature, user-confirmed business rules): closes the gap this codebase never
 * had a way to fill — SDevTech's `FEE_CHARGED` type exists in the schema and appears on 6,010
 * migrated transactions, but nothing in this system had ever produced one natively; the only
 * workaround was `AdjustFeesUseCase`, which carries correction semantics (no ledger transaction,
 * no reason recorded as a charge event) rather than "impose a new obligation."
 * - MIS/Accounting only (enforced by the HTTP layer, not here — same division of concerns as every
 *   other role-gated use case in this codebase).
 * - `amount` is a staff-entered fixed figure, not computed from a fee catalog — `FeeRule`/
 *   `AppliedFee` are scoped per `LoanProductVersion` (part of a product's origination-time fee
 *   schedule) and don't fit an ad-hoc late fee unrelated to product design; see the design
 *   discussion this session for the full reasoning.
 * - Per-installment, always additive (see `RepaymentInstallment.chargeFee()`'s own doc comment) —
 *   never blocked by an already-paid fees component, unlike `AdjustFeesUseCase`.
 *
 * Mirrors `ReducePenaltyUseCase`'s shape as closely as possible: mutate the installment via a
 * domain method, sync the loan's balance, create the immutable audit record, and — unlike Reduce
 * Penalty/Adjust Fees, which have no ledger impact — also create a real `FEE_CHARGED`
 * `LoanTransaction`, since a charge is a genuine financial event (TXN-1: no balance change without
 * a corresponding transaction row). This is what will show as "Fee Charged" in the Transaction
 * Report/Daily Collection Report once the borrower's later payment settles it, that settlement
 * itself replays through the ordinary `ProcessPaymentUseCase` waterfall and is what the Daily
 * Collection Report's row-splitting renders as "Fee Repayment" — `FEE_CHARGED` deliberately stays
 * out of the report's default "Payments only" view, since charging a fee isn't a collection.
 */
export class AddFeeUseCase {
  constructor(private readonly deps: AddFeeUseCaseDeps) {}

  async execute(installmentId: string, amount: Money, reason: string, chargedByUserId: string, chargedAt: Date = new Date()): Promise<void> {
    const installment = await this.deps.repaymentInstallmentRepository.findById(installmentId);
    if (!installment) {
      throw new NotFoundError('RepaymentInstallment', installmentId);
    }

    const loanAccount = await this.deps.loanAccountRepository.findById(installment.loanAccountId);
    if (!loanAccount) {
      throw new NotFoundError('LoanAccount', installment.loanAccountId);
    }

    const previousFeesDue = installment.effectiveFeesDue;

    // Validation (must be positive) lives on the entity itself — see
    // RepaymentInstallment.chargeFee()'s own doc comment.
    installment.chargeFee(amount, reason, chargedByUserId, chargedAt);
    const newFeesDue = installment.effectiveFeesDue;

    // Same helper ReducePenaltyUseCase/AdjustFeesUseCase already use to keep LoanAccount.balances
    // in sync - delta is (previous - new), which here is always -amount (negative), so subtracting
    // it increases feesBalance/feesDue by exactly the charged amount.
    loanAccount.adjustFeesBalance(previousFeesDue.subtract(newFeesDue));

    const transaction = LoanTransaction.create({
      loanAccountId: loanAccount.id,
      type: 'FEE_CHARGED',
      amount,
      components: { feesComponent: amount },
      balanceAfter: loanAccount.balances.principalBalance,
      postedByUserId: chargedByUserId,
      branchId: loanAccount.branchId,
      entryDate: chargedAt,
      comment: reason,
    });

    const charge = FeeCharge.create({
      repaymentInstallmentId: installment.id,
      loanTransactionId: transaction.id,
      previousFeesAmount: previousFeesDue,
      newFeesAmount: newFeesDue,
      reason,
      chargedByUserId,
    });

    await this.deps.unitOfWork.run(async (ctx) => {
      await this.deps.repaymentInstallmentRepository.save(installment, ctx);
      await this.deps.loanAccountRepository.save(loanAccount, ctx);
      await this.deps.loanTransactionRepository.create(transaction, ctx);
      await this.deps.feeChargeRepository.create(charge, ctx);
      await this.deps.financialAuditLogger.log(
        {
          userId: chargedByUserId,
          action: 'CHARGE_FEE',
          entityType: 'RepaymentInstallment',
          entityId: installment.id,
          previousValue: { feesDue: previousFeesDue.toString() },
          newValue: { feesDue: newFeesDue.toString(), amountCharged: amount.toString(), reason },
        },
        ctx,
      );
    });
  }
}
