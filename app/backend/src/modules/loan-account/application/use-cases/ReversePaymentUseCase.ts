import { NotFoundError } from '@shared/errors/DomainError';
import type { IUnitOfWork } from '@shared/application/ports/IUnitOfWork';
import type { IFinancialAuditLogger } from '@shared/application/ports/IFinancialAuditLogger';
import type { ILoanTransactionRepository } from '@modules/ledger/application/ports/ILoanTransactionRepository';
import type { IPaymentAllocationRepository } from '@modules/ledger/application/ports/IPaymentAllocationRepository';
import { LoanTransaction } from '@modules/ledger/domain/LoanTransaction';
import { TransactionComponents } from '@modules/ledger/domain/valueObjects/TransactionComponents';
import {
  NoReversibleAllocationDataError,
  TransactionAlreadyReversedError,
  TransactionNotReversibleError,
} from '@modules/ledger/domain/errors/LedgerDomainErrors';
import type { IRepaymentInstallmentRepository } from '@modules/repayment/application/ports/IRepaymentInstallmentRepository';
import type { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { InstallmentAmounts } from '@modules/repayment/domain/valueObjects/InstallmentAmounts';
import { LoanAccount } from '../../domain/LoanAccount';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';

export interface ReversePaymentUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
  loanTransactionRepository: ILoanTransactionRepository;
  paymentAllocationRepository: IPaymentAllocationRepository;
  financialAuditLogger: IFinancialAuditLogger;
  unitOfWork: IUnitOfWork;
}

/**
 * 2026-07-11 (Reverse Payment feature, user request via Payment Recording correction scenario):
 * "cashier entered the wrong amount, how do we correct it?" TXN-1 forbids editing or deleting the
 * wrong `LoanTransaction` — this creates a new, explicitly linked `REVERSAL` transaction that
 * exactly undoes the original REPAYMENT's effect instead. After reversing, the caller re-enters
 * the correct amount as an ordinary new payment via `ProcessPaymentUseCase` — this use case only
 * undoes, it never re-applies a corrected amount itself.
 *
 * Mechanically: negates the original transaction's `PaymentAllocation` rows (per installment) and
 * its aggregate `TransactionComponents`, then replays them through the exact same primitives
 * `ProcessPaymentUseCase` uses to apply a payment (`RepaymentInstallment.recordPayment()`,
 * `LoanAccount.applyPayment()`) — `Money`/`InstallmentAmounts`/`TransactionComponents` all already
 * support negative amounts by design (see `Money`'s own doc comment; a reversal is exactly the
 * case that support exists for), so no new domain methods were needed on either entity.
 *
 * Restrictions, all rejected with a typed `DomainError` rather than silently doing nothing:
 *   - Only a `REPAYMENT` transaction may be reversed (`TransactionNotReversibleError`) — not a
 *     DISBURSEMENT, not another REVERSAL.
 *   - A transaction may be reversed at most once (`TransactionAlreadyReversedError`), backed by
 *     the schema's own `reversesTransactionId @unique` constraint.
 *   - A transaction with no recorded `PaymentAllocation` breakdown (i.e. one recorded before this
 *     feature existed) cannot be precisely reversed (`NoReversibleAllocationDataError`) — see that
 *     error's own doc comment.
 *
 * Authorization (MIS only) and the mandatory `reason` are enforced by the HTTP layer
 * (`requireRole('MIS')`, `reversePaymentSchema`), not here — this use case takes `reason` as a
 * plain required string and always records it as the new transaction's `comment`, trusting the
 * caller already enforced non-emptiness.
 */
export class ReversePaymentUseCase {
  constructor(private readonly deps: ReversePaymentUseCaseDeps) {}

  async execute(
    loanAccountId: string,
    transactionId: string,
    reversedByUserId: string,
    reason: string,
    reversedAt: Date = new Date(),
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

    const existingReversal = await this.deps.loanTransactionRepository.findByReversesTransactionId(transactionId);
    if (existingReversal) {
      throw new TransactionAlreadyReversedError(transactionId);
    }

    const allocations = await this.deps.paymentAllocationRepository.findByLoanTransactionId(transactionId);
    if (allocations.length === 0) {
      throw new NoReversibleAllocationDataError(transactionId);
    }

    const installments = await this.deps.repaymentInstallmentRepository.findByLoanAccountId(loanAccountId);
    const installmentsById = new Map(installments.map((installment) => [installment.id, installment]));
    const installmentsToSave: RepaymentInstallment[] = [];

    for (const allocation of allocations) {
      const installment = installmentsById.get(allocation.repaymentInstallmentId);
      if (!installment) {
        continue; // Installments are never deleted, but guard rather than throw mid-reversal.
      }
      installment.recordPayment(
        InstallmentAmounts.of({
          principal: allocation.principalApplied.negate(),
          interest: allocation.interestApplied.negate(),
          fees: allocation.feesApplied.negate(),
          penalty: allocation.penaltyApplied.negate(),
        }),
        reversedAt,
      );
      installmentsToSave.push(installment);
    }

    const reversedComponents = TransactionComponents.of({
      principalComponent: original.components.principalComponent.negate(),
      interestComponent: original.components.interestComponent.negate(),
      feesComponent: original.components.feesComponent.negate(),
      penaltyComponent: original.components.penaltyComponent.negate(),
    });

    loanAccount.applyPayment(reversedComponents, reversedAt);

    const reversalTransaction = LoanTransaction.create({
      loanAccountId: loanAccount.id,
      type: 'REVERSAL',
      amount: original.amount.negate(),
      components: {
        principalComponent: reversedComponents.principalComponent,
        interestComponent: reversedComponents.interestComponent,
        feesComponent: reversedComponents.feesComponent,
        penaltyComponent: reversedComponents.penaltyComponent,
      },
      balanceAfter: loanAccount.balances.principalBalance,
      postedByUserId: reversedByUserId,
      branchId: loanAccount.branchId,
      entryDate: reversedAt,
      comment: reason,
      reversesTransactionId: original.id,
    });

    await this.deps.unitOfWork.run(async (ctx) => {
      await this.deps.loanAccountRepository.save(loanAccount, ctx);
      if (installmentsToSave.length > 0) {
        await this.deps.repaymentInstallmentRepository.saveMany(installmentsToSave, ctx);
      }
      await this.deps.loanTransactionRepository.create(reversalTransaction, ctx);
      await this.deps.financialAuditLogger.log(
        {
          userId: reversedByUserId,
          action: 'REVERSE_PAYMENT',
          entityType: 'LoanAccount',
          entityId: loanAccount.id,
          previousValue: { transactionId: original.id, amount: original.amount.toString() },
          newValue: { reversalTransactionId: reversalTransaction.id, reason },
        },
        ctx,
      );
    });

    return loanAccount;
  }
}
