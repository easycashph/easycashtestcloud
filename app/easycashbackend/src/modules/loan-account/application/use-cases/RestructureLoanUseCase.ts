import { NotFoundError } from '@shared/errors/DomainError';
import { env } from '@shared/config/env';
import { Money } from '@shared/domain/Money';
import { AmortizationScheduleGenerator } from '@shared/domain/calculation/AmortizationScheduleGenerator';
import type { IUnitOfWork } from '@shared/application/ports/IUnitOfWork';
import type { IFinancialAuditLogger } from '@shared/application/ports/IFinancialAuditLogger';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { ILoanProductRepository } from '@modules/loan-product/application/ports/ILoanProductRepository';
import type { ILoanTransactionRepository } from '@modules/ledger/application/ports/ILoanTransactionRepository';
import { LoanTransaction } from '@modules/ledger/domain/LoanTransaction';
import type { IRepaymentInstallmentRepository } from '@modules/repayment/application/ports/IRepaymentInstallmentRepository';
import { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { InstallmentAmounts } from '@modules/repayment/domain/valueObjects/InstallmentAmounts';
import { LoanAccount } from '../../domain/LoanAccount';
import { LoanRestructure } from '../../domain/LoanRestructure';
import { LoanAlreadyRestructuredError, LoanNotEligibleForRestructureError, UnsupportedInterestCalculationMethodError } from '../../domain/errors/LoanAccountDomainErrors';
import { resolveSecMc3Coverage } from '../services/SecMc3CoverageResolver';
import { AccruedInterestCalculator } from '../services/AccruedInterestCalculator';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';
import type { ILoanRestructureRepository } from '../ports/ILoanRestructureRepository';

export interface RestructureLoanUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  loanProductRepository: ILoanProductRepository;
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
  loanTransactionRepository: ILoanTransactionRepository;
  loanRestructureRepository: ILoanRestructureRepository;
  financialAuditLogger: IFinancialAuditLogger;
  unitOfWork: IUnitOfWork;
  profileActivityLogService?: ProfileActivityLogService;
}

export interface RestructureLoanInput {
  oldLoanAccountId: string;
  installmentCount: number;
  firstRepaymentDate: Date;
  reason?: string;
  restructuredByUserId: string;
}

/** Mirrors `ActivateLoanUseCase`'s identical, non-exported helper — ADR-045: calendar-month
 * spacing is a deterministic consequence of `repaymentPeriodUnit` being MONTHS, not a business
 * decision of its own. Duplicated (not imported) so the whole restructure — creating the new
 * loan, generating its schedule, posting its disbursement, AND closing the old loan — stays one
 * atomic `IUnitOfWork.run()` block; `ActivateLoanUseCase.execute()` runs its own separate
 * transaction and re-fetches from the repository, which would break that atomicity if reused
 * directly here. */
function addMonths(date: Date, months: number): Date {
  const targetMonthIndex = date.getUTCMonth() + months;
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), daysInTargetMonth);
  return new Date(
    Date.UTC(targetYear, targetMonth, day, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()),
  );
}

/**
 * 2026-07-24 (Loan Restructure feature, user-confirmed business rules — CLAUDE.md "never invent
 * business rules," every rule here was asked, not assumed):
 * - Offered only for an ACTIVE/ACTIVE_IN_ARREARS loan that is currently past due or matured — a
 *   current/good-standing loan is refused (`LoanNotEligibleForRestructureError`).
 * - Exactly once per loan account — enforced via `LoanRestructure.oldLoanAccountId`'s unique
 *   constraint, pre-checked here for a fast, friendly error (`LoanAlreadyRestructuredError`).
 * - 2026-07-24 follow-up (user-confirmed, after Accrued Interest shipped): the new loan's
 *   principal = unpaid Principal + unpaid Interest (across the WHOLE remaining schedule, every
 *   installment whether due yet or not) + unpaid Penalty (frozen at maturity, naturally ₱0 for a
 *   not-yet-due installment) + Accrued Interest (0 before maturity - `AccruedInterestCalculator`)
 *   + unpaid Fees. Despite the interest-on-interest/SEC-MC3-non-compounding-penalty implications
 *   discussed with the user; mitigated by making this explicit on the new loan's Disclosure
 *   Statement (existing ADR-051 document generation, unchanged by this feature).
 * - Product/interest rate are copied from the old loan (its own LA-4 snapshot fields) — user
 *   chose NOT to let staff pick a different product. Term (`installmentCount`) and
 *   `firstRepaymentDate` ARE staff-entered, per ADR-045's "no recoverable generation rule" stance
 *   on `firstRepaymentDate` (mirrors `CreateLoanAccountUseCase`'s identical requirement).
 * - Goes directly to ACTIVE — no approval step (user-confirmed: "isang click lang"). Internally
 *   still passes through `LoanAccount.create()` (PENDING_APPROVAL) -> `approve()` -> the same
 *   schedule-generation/disbursement mechanics `ActivateLoanUseCase` uses, all inside one
 *   transaction, so every existing invariant about what ACTIVE means (populated balances, a real
 *   RepaymentInstallment schedule, a DISBURSEMENT LoanTransaction) still holds.
 * - The old loan is marked `CLOSED_RESTRUCTURED` (`LoanAccount.restructureClose()`) — its balance
 *   columns are left untouched/frozen, never zeroed, since nothing was actually collected or
 *   written off; the balance simply moved to the new account. The DISBURSEMENT `LoanTransaction`
 *   on the new loan is tagged `paymentMethod: 'RESTRUCTURE'` so it's traceable in the ledger too.
 * - MIS/Accounting-only — enforced at the HTTP layer (`loanAccountRouter.ts`), not here, same
 *   division of concerns as every other role-gated use case in this codebase.
 */
export class RestructureLoanUseCase {
  constructor(private readonly deps: RestructureLoanUseCaseDeps) {}

  async execute(input: RestructureLoanInput): Promise<{ oldLoanAccount: LoanAccount; newLoanAccount: LoanAccount }> {
    const oldLoanAccount = await this.deps.loanAccountRepository.findById(input.oldLoanAccountId);
    if (!oldLoanAccount) {
      throw new NotFoundError('LoanAccount', input.oldLoanAccountId);
    }

    if (oldLoanAccount.status !== 'ACTIVE' && oldLoanAccount.status !== 'ACTIVE_IN_ARREARS') {
      throw new LoanNotEligibleForRestructureError(oldLoanAccount.id, `status is ${oldLoanAccount.status}, must be ACTIVE or ACTIVE_IN_ARREARS`);
    }

    const alreadyRestructured = await this.deps.loanRestructureRepository.findByOldLoanAccountId(oldLoanAccount.id);
    if (alreadyRestructured) {
      throw new LoanAlreadyRestructuredError(oldLoanAccount.id);
    }

    const installments = await this.deps.repaymentInstallmentRepository.findByLoanAccountId(oldLoanAccount.id);
    const now = new Date();
    const isPastDueOrMatured = installments.some((i) => i.dueDate < now && i.paid.total().lessThan(i.due.total()));
    if (!isPastDueOrMatured) {
      throw new LoanNotEligibleForRestructureError(oldLoanAccount.id, 'no past due or matured installment - only offered for past due/matured accounts');
    }

    const loanProductVersion = await this.deps.loanProductRepository.findVersionById(oldLoanAccount.loanProductVersionId);
    if (!loanProductVersion) {
      throw new NotFoundError('LoanProductVersion', oldLoanAccount.loanProductVersionId);
    }
    if (loanProductVersion.interestCalculationMethod === 'FLAT') {
      throw new UnsupportedInterestCalculationMethodError(loanProductVersion.interestCalculationMethod);
    }

    // 2026-07-24 (user-confirmed, follow-up after the Accrued Interest feature shipped): new
    // principal = unpaid Principal + unpaid Interest across the WHOLE remaining schedule (every
    // installment, due or not - "kahit hindi pa due ang installment") + unpaid Penalty (frozen at
    // maturity, per-installment - naturally ₱0 for a not-yet-due installment, no separate
    // filtering needed) + Accrued Interest (0 before maturity) + unpaid Fees. Replaces the
    // original `collectionsBalance`-based figure, which didn't yet account for Accrued Interest.
    // `AccruedInterestCalculator.restructureNewPrincipal` computes exactly this - shared with the
    // Loan Detail page's own accrued-interest query so the Restructure dialog's preview and this
    // use case's actual charge always agree.
    const isSecMc3Covered = await resolveSecMc3Coverage(oldLoanAccount, this.deps.loanProductRepository);
    const accruedInterestFigures = AccruedInterestCalculator.calculate(
      installments,
      {
        isProspectiveLoan: true,
        autoComputeEnabled: env.PENALTY_AUTO_COMPUTE_ENABLED,
        principalAmount: oldLoanAccount.principalAmount,
        isSecMc3Covered,
      },
      oldLoanAccount.contractualInterestRate,
      now,
    );
    const newPrincipalAmount = accruedInterestFigures.restructureNewPrincipal;
    const loanCode = await this.generateLoanCode(oldLoanAccount.loanProductVersionId);

    const newLoanAccount = LoanAccount.create({
      loanCode,
      borrowerId: oldLoanAccount.borrowerId,
      loanProductVersionId: oldLoanAccount.loanProductVersionId,
      branchId: oldLoanAccount.branchId,
      loanOfficerId: oldLoanAccount.loanOfficerId,
      principalAmount: newPrincipalAmount,
      interestRate: oldLoanAccount.interestRate,
      addOnInterestRate: oldLoanAccount.addOnInterestRate,
      contractualInterestRate: oldLoanAccount.contractualInterestRate,
      installmentCount: input.installmentCount,
      gracePeriodDays: oldLoanAccount.gracePeriodDays,
      firstRepaymentDate: input.firstRepaymentDate,
    });
    newLoanAccount.approve(input.restructuredByUserId);

    const { schedule } = AmortizationScheduleGenerator.generate(newPrincipalAmount, newLoanAccount.interestRate, input.installmentCount);
    const principalDue = newPrincipalAmount;
    const interestDue = schedule.reduce((total, entry) => total.add(entry.interestPortion), Money.ZERO);
    const activatedAt = new Date();
    newLoanAccount.activate({ principalDue, interestDue, activatedAt });

    const newInstallments = schedule.map((entry) =>
      RepaymentInstallment.create({
        loanAccountId: newLoanAccount.id,
        installmentNumber: entry.installmentNumber,
        dueDate: addMonths(input.firstRepaymentDate, entry.installmentNumber - 1),
        due: InstallmentAmounts.of({ principal: entry.principalPortion, interest: entry.interestPortion }),
      }),
    );

    const disbursementTransaction = LoanTransaction.create({
      loanAccountId: newLoanAccount.id,
      type: 'DISBURSEMENT',
      amount: principalDue,
      components: { principalComponent: principalDue },
      balanceAfter: principalDue,
      postedByUserId: input.restructuredByUserId,
      branchId: newLoanAccount.branchId,
      entryDate: activatedAt,
      paymentMethod: 'RESTRUCTURE',
      comment: `Restructured from loan ${oldLoanAccount.loanCode}`,
    });

    oldLoanAccount.restructureClose();

    const restructure = LoanRestructure.create({
      oldLoanAccountId: oldLoanAccount.id,
      newLoanAccountId: newLoanAccount.id,
      previousCollectionsBalance: newPrincipalAmount,
      newPrincipalAmount,
      reason: input.reason,
      restructuredByUserId: input.restructuredByUserId,
    });

    await this.deps.unitOfWork.run(async (ctx) => {
      await this.deps.loanAccountRepository.save(newLoanAccount, ctx);
      await this.deps.repaymentInstallmentRepository.saveMany(newInstallments, ctx);
      await this.deps.loanTransactionRepository.create(disbursementTransaction, ctx);
      await this.deps.loanAccountRepository.save(oldLoanAccount, ctx);
      await this.deps.loanRestructureRepository.create(restructure, ctx);
      await this.deps.financialAuditLogger.log(
        {
          userId: input.restructuredByUserId,
          action: 'RESTRUCTURE_LOAN',
          entityType: 'LoanAccount',
          entityId: oldLoanAccount.id,
          previousValue: { status: 'ACTIVE', loanCode: oldLoanAccount.loanCode },
          newValue: { status: 'CLOSED_RESTRUCTURED', newLoanAccountId: newLoanAccount.id, newLoanCode: newLoanAccount.loanCode, newPrincipalAmount: newPrincipalAmount.toString() },
        },
        ctx,
      );
    });

    if (this.deps.profileActivityLogService) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'LOAN_ACCOUNT',
        profileId: oldLoanAccount.id,
        userId: input.restructuredByUserId,
        ...ProfileActivityLogService.actions.decisionUpdated('ACTIVE', 'CLOSED_RESTRUCTURED', input.reason, { newLoanAccountId: newLoanAccount.id, newLoanCode: newLoanAccount.loanCode }),
      });
    }

    return { oldLoanAccount, newLoanAccount };
  }

  /** Mirrors `CreateLoanAccountUseCase.generateLoanCode`'s identical `{productCode}_{NNNNN}` convention. */
  private async generateLoanCode(loanProductVersionId: string): Promise<string> {
    const version = await this.deps.loanProductRepository.findVersionById(loanProductVersionId);
    if (!version) {
      throw new NotFoundError('LoanProductVersion', loanProductVersionId);
    }
    const product = await this.deps.loanProductRepository.findById(version.loanProductId);
    if (!product) {
      throw new NotFoundError('LoanProduct', version.loanProductId);
    }
    const nextSequence = (await this.deps.loanAccountRepository.findMaxLoanCodeSequenceForPrefix(product.code)) + 1;
    return `${product.code}_${String(nextSequence).padStart(5, '0')}`;
  }
}
