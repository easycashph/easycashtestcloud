import { NotFoundError } from '@shared/errors/DomainError';
import { Money } from '@shared/domain/Money';
import {
  PaymentAllocationService,
  type AllocatableInstallment,
  type InstallmentAllocation,
} from '@shared/domain/calculation/PaymentAllocationService';
import { InvalidPaymentAllocationInputError } from '@shared/domain/calculation/errors/CalculationDomainErrors';
import type { IUnitOfWork } from '@shared/application/ports/IUnitOfWork';
import type { IFinancialAuditLogger } from '@shared/application/ports/IFinancialAuditLogger';
import type { ILoanTransactionRepository } from '@modules/ledger/application/ports/ILoanTransactionRepository';
import { LoanTransaction } from '@modules/ledger/domain/LoanTransaction';
import { TransactionComponents } from '@modules/ledger/domain/valueObjects/TransactionComponents';
import type { IRepaymentInstallmentRepository } from '@modules/repayment/application/ports/IRepaymentInstallmentRepository';
import type { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { InstallmentAmounts } from '@modules/repayment/domain/valueObjects/InstallmentAmounts';
import { LoanAccount } from '../../domain/LoanAccount';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';

export interface ProcessPaymentUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
  loanTransactionRepository: ILoanTransactionRepository;
  financialAuditLogger: IFinancialAuditLogger;
  unitOfWork: IUnitOfWork;
}

export interface ProcessPaymentResult {
  loanAccount: LoanAccount;
  /**
   * Unapplied excess after every unpaid installment's tiers are exhausted
   * (overpayment). `CALCULATION_ENGINE_SPEC.md` §11: `STATUS: UNRESOLVED`
   * — no legacy evidence of how an overpayment was ever recorded. Surfaced
   * here as an explicit output, never silently discarded, absorbed into
   * any balance, or given an invented disposition. The caller decides
   * what to do with it (or does nothing yet, pending that decision).
   */
  remainder: Money;
}

/**
 * Converts a `RepaymentInstallment`'s *remaining* due amounts (due minus
 * already-paid, per component) into the structural shape
 * `PaymentAllocationService` needs. Using remaining-due rather than raw
 * `due` is required for correctness on a `PARTIALLY_PAID` installment —
 * `due` is immutable and never reflects prior payments (REPAY-3 /
 * `FINANCIAL_INVARIANTS.md` §1); allocating against raw `due` would offer
 * an already-paid portion to this payment a second time.
 */
function toRemainingDue(installment: RepaymentInstallment): AllocatableInstallment {
  return {
    id: installment.id,
    dueDate: installment.dueDate,
    feesDue: installment.due.fees.subtract(installment.paid.fees),
    penaltyDue: installment.due.penalty.subtract(installment.paid.penalty),
    interestDue: installment.due.interest.subtract(installment.paid.interest),
    principalDue: installment.due.principal.subtract(installment.paid.principal),
  };
}

/**
 * A staff-entered per-installment override of `PaymentAllocationService`'s
 * automatic fees->penalty->interest->principal waterfall (2026-07-10, user
 * request via Payment Recording's "Manual" tab). Every field is required
 * (even if zero) so a caller cannot omit a component by accident.
 */
export interface ManualAllocationInput {
  installmentId: string;
  principal: Money;
  interest: Money;
  penalty: Money;
  fees: Money;
}

/**
 * Validates and converts staff-entered manual allocations into the same
 * `InstallmentAllocation[]` shape `PaymentAllocationService.allocate()`
 * produces, so the rest of `execute()` (recordPayment, ledger totals,
 * transaction) needs no manual-vs-automatic branching beyond this point.
 *
 * Unlike the automatic engine, manual mode never carries a remainder —
 * the caller committed to an exact split, so any mismatch against
 * `paymentAmount` or against an installment's remaining due is a hard
 * rejection (400), not something silently absorbed.
 */
function toManualAllocations(
  manualAllocations: readonly ManualAllocationInput[],
  paymentAmount: Money,
  unpaidInstallments: readonly RepaymentInstallment[],
): InstallmentAllocation[] {
  if (manualAllocations.length === 0) {
    throw new InvalidPaymentAllocationInputError('at least one installment allocation is required for a manual payment.');
  }

  const remainingDueById = new Map(unpaidInstallments.map((i) => [i.id, toRemainingDue(i)]));
  const seenInstallmentIds = new Set<string>();
  let total = Money.ZERO;

  const allocations: InstallmentAllocation[] = manualAllocations.map((entry) => {
    if (seenInstallmentIds.has(entry.installmentId)) {
      throw new InvalidPaymentAllocationInputError(`installment "${entry.installmentId}" was specified more than once.`);
    }
    seenInstallmentIds.add(entry.installmentId);

    const remaining = remainingDueById.get(entry.installmentId);
    if (!remaining) {
      throw new InvalidPaymentAllocationInputError(
        `installment "${entry.installmentId}" is not an unpaid installment on this loan.`,
      );
    }

    for (const [label, applied, due] of [
      ['principal', entry.principal, remaining.principalDue],
      ['interest', entry.interest, remaining.interestDue],
      ['penalty', entry.penalty, remaining.penaltyDue],
      ['fees', entry.fees, remaining.feesDue],
    ] as const) {
      if (applied.isNegative()) {
        throw new InvalidPaymentAllocationInputError(`${label} amount for installment "${entry.installmentId}" cannot be negative.`);
      }
      if (applied.greaterThan(due)) {
        throw new InvalidPaymentAllocationInputError(
          `${label} amount for installment "${entry.installmentId}" (${applied.toString()}) exceeds its remaining ${label} due (${due.toString()}).`,
        );
      }
    }

    total = total.add(entry.principal).add(entry.interest).add(entry.penalty).add(entry.fees);

    return {
      installmentId: entry.installmentId,
      principalApplied: entry.principal,
      interestApplied: entry.interest,
      penaltyApplied: entry.penalty,
      feesApplied: entry.fees,
    };
  });

  if (!total.equals(paymentAmount)) {
    throw new InvalidPaymentAllocationInputError(
      `manual allocations total ${total.toString()} does not match the payment amount ${paymentAmount.toString()}.`,
    );
  }

  return allocations;
}

/**
 * Milestone 9.1 checkpoint 9 / ADR-009: one business event (a payment),
 * several internal writes, all inside one `IUnitOfWork.run()` call — the
 * same shape as CP8's `ActivateLoanUseCase` (`ADR-032` §5,
 * `FINANCIAL_INVARIANTS.md` §7):
 *   1. Fetch the `LoanAccount` and its not-yet-fully-paid
 *      `RepaymentInstallment`s, sorted oldest-due-first — per `ADR-009` §2,
 *      this cross-installment ordering is the only observed pattern
 *      (`STATUS: PARTIALLY CONFIRMED`, not a proven rule, no contrary
 *      evidence either).
 *   2. `PaymentAllocationService.allocate()` (CP4, already built) computes
 *      the fees -> penalty -> interest -> principal split across those
 *      installments, per `ADR-009` §1/`CALCULATION_ENGINE_SPEC.md` §5.
 *   3. Each installment that received a nonzero share records its payment
 *      via the existing `RepaymentInstallment.recordPayment()` primitive
 *      (Milestone 7) — installments the payment never reached are left
 *      untouched (no write, no version bump).
 *   4. The sum of every applied component becomes one `TransactionComponents`
 *      passed to `LoanAccount.applyPayment()` (CP7, already built).
 *   5. A `REPAYMENT`-typed `LoanTransaction` insert, `amount` equal to
 *      what was actually applied (`paymentAmount - remainder`) — not the
 *      raw `paymentAmount` — because `LoanTransaction.create()`'s own
 *      TXN-2 invariant requires `amount === components.sum()`, and the
 *      unapplied remainder was not applied to any component.
 *   6. A financial audit log entry (CP2, fail-closed — no try/catch
 *      around it, so a rejection aborts the whole transaction, including
 *      1-5; `FINANCIAL_INVARIANTS.md` §4).
 *
 * `paymentAmount <= 0` is rejected by `PaymentAllocationService.allocate()`
 * itself (`InvalidPaymentAllocationInputError`) — deliberately not
 * duplicated here.
 *
 * The overpayment `remainder` (`CALCULATION_ENGINE_SPEC.md` §11,
 * `STATUS: UNRESOLVED`) is returned as an explicit output field
 * (`ProcessPaymentResult.remainder`), never folded into any balance,
 * discarded, or given an invented disposition — see that field's own doc
 * comment.
 *
 * `balanceAfter` on the `REPAYMENT` transaction is `LoanAccount.
 * balances.principalBalance` after `applyPayment()` — the same
 * principal-only running-total interpretation `ActivateLoanUseCase` (CP8)
 * already established for this column, kept consistent rather than
 * inventing a second interpretation; this does not pre-decide `ADR-007`
 * §3's separate, still-open "does outstandingBalance include penalty"
 * question, which concerns a not-yet-built summary getter (CP11), not this
 * column.
 *
 * Deliberately excludes (not this checkpoint's scope): any HTTP route
 * (CP13, future milestone — this use case has no controller/router,
 * following the same D-2 precedent as CP8's `ActivateLoanUseCase`), and
 * any invented overpayment disposition (see above).
 */
export class ProcessPaymentUseCase {
  constructor(private readonly deps: ProcessPaymentUseCaseDeps) {}

  async execute(
    loanAccountId: string,
    paymentAmount: Money,
    postedByUserId: string,
    paidAt: Date = new Date(),
    manualAllocations?: readonly ManualAllocationInput[],
    orNumber?: string,
    arNumber?: string,
  ): Promise<ProcessPaymentResult> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) {
      throw new NotFoundError('LoanAccount', loanAccountId);
    }

    const allInstallments = await this.deps.repaymentInstallmentRepository.findByLoanAccountId(loanAccountId);
    const unpaidInstallments = allInstallments
      .filter((installment) => installment.status !== 'PAID')
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    const { allocations, remainder } = manualAllocations
      ? { allocations: toManualAllocations(manualAllocations, paymentAmount, unpaidInstallments), remainder: Money.ZERO }
      : PaymentAllocationService.allocate(paymentAmount, unpaidInstallments.map(toRemainingDue));

    const installmentsById = new Map(unpaidInstallments.map((installment) => [installment.id, installment]));
    const installmentsToSave: RepaymentInstallment[] = [];

    let totalFeesApplied = Money.ZERO;
    let totalPenaltyApplied = Money.ZERO;
    let totalInterestApplied = Money.ZERO;
    let totalPrincipalApplied = Money.ZERO;

    for (const allocation of allocations) {
      const appliedTotal = allocation.feesApplied
        .add(allocation.penaltyApplied)
        .add(allocation.interestApplied)
        .add(allocation.principalApplied);
      if (appliedTotal.isZero()) {
        continue;
      }

      const installment = installmentsById.get(allocation.installmentId);
      if (!installment) {
        continue;
      }

      installment.recordPayment(
        InstallmentAmounts.of({
          principal: allocation.principalApplied,
          interest: allocation.interestApplied,
          fees: allocation.feesApplied,
          penalty: allocation.penaltyApplied,
        }),
        paidAt,
      );
      installmentsToSave.push(installment);

      totalFeesApplied = totalFeesApplied.add(allocation.feesApplied);
      totalPenaltyApplied = totalPenaltyApplied.add(allocation.penaltyApplied);
      totalInterestApplied = totalInterestApplied.add(allocation.interestApplied);
      totalPrincipalApplied = totalPrincipalApplied.add(allocation.principalApplied);
    }

    const components = {
      principalComponent: totalPrincipalApplied,
      interestComponent: totalInterestApplied,
      feesComponent: totalFeesApplied,
      penaltyComponent: totalPenaltyApplied,
    };

    loanAccount.applyPayment(TransactionComponents.of(components), paidAt);

    const appliedAmount = paymentAmount.subtract(remainder);
    const repaymentTransaction = LoanTransaction.create({
      loanAccountId: loanAccount.id,
      type: 'REPAYMENT',
      amount: appliedAmount,
      components,
      balanceAfter: loanAccount.balances.principalBalance,
      postedByUserId,
      branchId: loanAccount.branchId,
      entryDate: paidAt,
      orNumber,
      arNumber,
    });

    await this.deps.unitOfWork.run(async (ctx) => {
      await this.deps.loanAccountRepository.save(loanAccount, ctx);
      if (installmentsToSave.length > 0) {
        await this.deps.repaymentInstallmentRepository.saveMany(installmentsToSave, ctx);
      }
      await this.deps.loanTransactionRepository.create(repaymentTransaction, ctx);
      await this.deps.financialAuditLogger.log(
        {
          userId: postedByUserId,
          action: 'PROCESS_PAYMENT',
          entityType: 'LoanAccount',
          entityId: loanAccount.id,
          previousValue: undefined,
          newValue: {
            paymentAmount: paymentAmount.toString(),
            appliedAmount: appliedAmount.toString(),
            remainder: remainder.toString(),
          },
        },
        ctx,
      );
    });

    return { loanAccount, remainder };
  }
}
