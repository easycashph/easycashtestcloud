import { NotFoundError } from '@shared/errors/DomainError';
import { Money } from '@shared/domain/Money';
import type { IUnitOfWork } from '@shared/application/ports/IUnitOfWork';
import type { IFinancialAuditLogger } from '@shared/application/ports/IFinancialAuditLogger';
import type { ILoanTransactionRepository } from '@modules/ledger/application/ports/ILoanTransactionRepository';
import type { IPaymentAllocationRepository } from '@modules/ledger/application/ports/IPaymentAllocationRepository';
import type { IPaymentAdjustmentRepository } from '@modules/ledger/application/ports/IPaymentAdjustmentRepository';
import { LoanTransaction } from '@modules/ledger/domain/LoanTransaction';
import { PaymentAdjustment } from '@modules/ledger/domain/PaymentAdjustment';
import { TransactionComponents } from '@modules/ledger/domain/valueObjects/TransactionComponents';
import {
  TransactionNotReversibleError,
  TransactionHasAllocationDataError,
  PaymentAdjustmentExceedsPaidAmountError,
  EmptyPaymentAdjustmentError,
} from '@modules/ledger/domain/errors/LedgerDomainErrors';
import type { IRepaymentInstallmentRepository } from '@modules/repayment/application/ports/IRepaymentInstallmentRepository';
import type { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { InstallmentAmounts } from '@modules/repayment/domain/valueObjects/InstallmentAmounts';
import { LoanAccount } from '../../domain/LoanAccount';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';

export interface ManualPaymentAdjustmentUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
  loanTransactionRepository: ILoanTransactionRepository;
  paymentAllocationRepository: IPaymentAllocationRepository;
  paymentAdjustmentRepository: IPaymentAdjustmentRepository;
  financialAuditLogger: IFinancialAuditLogger;
  unitOfWork: IUnitOfWork;
}

export interface ManualPaymentAdjustmentLineInput {
  installmentId: string;
  /** Amount to REDUCE from this installment's currently-recorded `paid` for each component — a
   * positive number entered by staff meaning "subtract this much," not a signed delta. Zero for a
   * component that's untouched on this line. */
  principalReduction: Money;
  interestReduction: Money;
  feesReduction: Money;
  penaltyReduction: Money;
}

/**
 * 2026-08-14 (Manual Payment Adjustment feature, user-confirmed): the "manual adjustment" tool
 * `NoReversibleAllocationDataError`'s message points to, which didn't exist until now. Exists
 * specifically for a legacy REPAYMENT transaction with no `PaymentAllocation` breakdown — see that
 * error's and `PaymentAdjustment`'s own doc comments for the full gap this closes.
 *
 * Mechanically mirrors `ReversePaymentUseCase` as closely as possible: negates staff-specified
 * amounts and replays them through the same primitives (`RepaymentInstallment.recordPayment()`,
 * `LoanAccount.applyPayment()`), then records a new `ADJUSTMENT`-type `LoanTransaction` (not
 * `REVERSAL` — `reversesTransactionId` stays reserved for the precise, automatic Reverse Payment
 * flow) so the loan's transaction history explains the balance change, exactly like every other
 * ledger-affecting action in this system (TXN-1: no balance change without a corresponding
 * transaction row).
 *
 * Differs from `ReversePaymentUseCase` in the two places a human-typed guess needs guards a replay
 * of exact prior amounts doesn't:
 *   - Refuses transactions that DO have `PaymentAllocation` rows (`TransactionHasAllocationDataError`)
 *     — those must go through the precise Reverse Payment flow instead, not this one.
 *   - Refuses a reduction that would take any installment's recorded paid amount for a component
 *     below zero (`PaymentAdjustmentExceedsPaidAmountError`) — `recordPayment()` itself has no such
 *     floor (see its own doc comment), so this use case enforces it before calling that method.
 *
 * Authorization (`payment.manual_adjust`) and the mandatory `reason` are enforced by the HTTP layer,
 * same division of concerns as every other role-gated use case in this codebase.
 */
export class ManualPaymentAdjustmentUseCase {
  constructor(private readonly deps: ManualPaymentAdjustmentUseCaseDeps) {}

  async execute(
    loanAccountId: string,
    transactionId: string,
    lines: ManualPaymentAdjustmentLineInput[],
    reason: string,
    adjustedByUserId: string,
    adjustedAt: Date = new Date(),
  ): Promise<LoanAccount> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) {
      throw new NotFoundError('LoanAccount', loanAccountId);
    }

    const original = await this.deps.loanTransactionRepository.findById(transactionId);
    if (!original || original.loanAccountId !== loanAccountId) {
      throw new NotFoundError('LoanTransaction', transactionId);
    }
    if (original.type !== 'REPAYMENT') {
      throw new TransactionNotReversibleError(original.type);
    }

    const existingAllocations = await this.deps.paymentAllocationRepository.findByLoanTransactionId(transactionId);
    if (existingAllocations.length > 0) {
      throw new TransactionHasAllocationDataError(transactionId);
    }

    const meaningfulLines = lines.filter(
      (line) =>
        line.principalReduction.isPositive() ||
        line.interestReduction.isPositive() ||
        line.feesReduction.isPositive() ||
        line.penaltyReduction.isPositive(),
    );
    if (meaningfulLines.length === 0) {
      throw new EmptyPaymentAdjustmentError();
    }

    const installments = await this.deps.repaymentInstallmentRepository.findByLoanAccountId(loanAccountId);
    const installmentsById = new Map(installments.map((installment) => [installment.id, installment]));
    const installmentsToSave: RepaymentInstallment[] = [];
    const adjustmentRecords: PaymentAdjustment[] = [];

    let totalPrincipalReduced = Money.ZERO;
    let totalInterestReduced = Money.ZERO;
    let totalFeesReduced = Money.ZERO;
    let totalPenaltyReduced = Money.ZERO;

    for (const line of meaningfulLines) {
      const installment = installmentsById.get(line.installmentId);
      if (!installment || installment.loanAccountId !== loanAccountId) {
        throw new NotFoundError('RepaymentInstallment', line.installmentId);
      }

      const previousPaid = installment.paid;
      if (line.principalReduction.greaterThan(previousPaid.principal)) {
        throw new PaymentAdjustmentExceedsPaidAmountError(installment.id, 'principal');
      }
      if (line.interestReduction.greaterThan(previousPaid.interest)) {
        throw new PaymentAdjustmentExceedsPaidAmountError(installment.id, 'interest');
      }
      if (line.feesReduction.greaterThan(previousPaid.fees)) {
        throw new PaymentAdjustmentExceedsPaidAmountError(installment.id, 'fees');
      }
      if (line.penaltyReduction.greaterThan(previousPaid.penalty)) {
        throw new PaymentAdjustmentExceedsPaidAmountError(installment.id, 'penalty');
      }

      installment.recordPayment(
        InstallmentAmounts.of({
          principal: line.principalReduction.negate(),
          interest: line.interestReduction.negate(),
          fees: line.feesReduction.negate(),
          penalty: line.penaltyReduction.negate(),
        }),
        adjustedAt,
      );
      installmentsToSave.push(installment);

      adjustmentRecords.push(
        PaymentAdjustment.create({
          loanTransactionId: original.id,
          repaymentInstallmentId: installment.id,
          previousPrincipalPaid: previousPaid.principal,
          previousInterestPaid: previousPaid.interest,
          previousFeesPaid: previousPaid.fees,
          previousPenaltyPaid: previousPaid.penalty,
          newPrincipalPaid: installment.paid.principal,
          newInterestPaid: installment.paid.interest,
          newFeesPaid: installment.paid.fees,
          newPenaltyPaid: installment.paid.penalty,
          reason,
          adjustedByUserId,
        }),
      );

      totalPrincipalReduced = totalPrincipalReduced.add(line.principalReduction);
      totalInterestReduced = totalInterestReduced.add(line.interestReduction);
      totalFeesReduced = totalFeesReduced.add(line.feesReduction);
      totalPenaltyReduced = totalPenaltyReduced.add(line.penaltyReduction);
    }

    const adjustmentComponents = TransactionComponents.of({
      principalComponent: totalPrincipalReduced.negate(),
      interestComponent: totalInterestReduced.negate(),
      feesComponent: totalFeesReduced.negate(),
      penaltyComponent: totalPenaltyReduced.negate(),
    });

    loanAccount.applyPayment(adjustmentComponents, adjustedAt);

    if (loanAccount.status === 'CLOSED' && !loanAccount.isFullyPaid) {
      loanAccount.reopen();
    }

    const adjustmentTotal = totalPrincipalReduced.add(totalInterestReduced).add(totalFeesReduced).add(totalPenaltyReduced);
    const adjustmentTransaction = LoanTransaction.create({
      loanAccountId: loanAccount.id,
      type: 'ADJUSTMENT',
      amount: adjustmentTotal.negate(),
      components: {
        principalComponent: adjustmentComponents.principalComponent,
        interestComponent: adjustmentComponents.interestComponent,
        feesComponent: adjustmentComponents.feesComponent,
        penaltyComponent: adjustmentComponents.penaltyComponent,
      },
      balanceAfter: loanAccount.balances.principalBalance,
      postedByUserId: adjustedByUserId,
      branchId: loanAccount.branchId,
      entryDate: adjustedAt,
      comment: `Manual adjustment of transaction ${original.id} (${original.entryDate.toISOString().slice(0, 10)}): ${reason}`,
    });

    await this.deps.unitOfWork.run(async (ctx) => {
      await this.deps.loanAccountRepository.save(loanAccount, ctx);
      await this.deps.repaymentInstallmentRepository.saveMany(installmentsToSave, ctx);
      await this.deps.loanTransactionRepository.create(adjustmentTransaction, ctx);
      await this.deps.paymentAdjustmentRepository.createMany(adjustmentRecords, ctx);
      await this.deps.financialAuditLogger.log(
        {
          userId: adjustedByUserId,
          action: 'MANUAL_PAYMENT_ADJUSTMENT',
          entityType: 'LoanAccount',
          entityId: loanAccount.id,
          previousValue: { transactionId: original.id, amount: original.amount.toString() },
          newValue: { adjustmentTransactionId: adjustmentTransaction.id, reason },
        },
        ctx,
      );
    });

    return loanAccount;
  }
}
