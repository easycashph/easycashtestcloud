import { NotFoundError } from '@shared/errors/DomainError';
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
import { LoanAdjustment } from '../../domain/LoanAdjustment';
import { LoanAlreadyAdjustedError, LoanNotEligibleForAdjustmentError, UnsupportedInterestCalculationMethodError } from '../../domain/errors/LoanAccountDomainErrors';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';
import type { ILoanAdjustmentRepository } from '../ports/ILoanAdjustmentRepository';

export interface AdjustLoanUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  loanProductRepository: ILoanProductRepository;
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
  loanTransactionRepository: ILoanTransactionRepository;
  loanAdjustmentRepository: ILoanAdjustmentRepository;
  financialAuditLogger: IFinancialAuditLogger;
  unitOfWork: IUnitOfWork;
  profileActivityLogService?: ProfileActivityLogService;
}

export interface AdjustLoanInput {
  oldLoanAccountId: string;
  firstRepaymentDate: Date;
  reason?: string;
  adjustedByUserId: string;
}

/** Mirrors `RestructureLoanUseCase`'s identical, non-exported helper (ADR-045). Duplicated (not
 * imported) for the same atomicity reason: the whole adjustment stays one `IUnitOfWork.run()`
 * block, so `ActivateLoanUseCase`'s own separate transaction can't be reused here directly. */
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
 * 2026-07-24 (Loan Adjustment feature, user-confirmed business rules — CLAUDE.md "never invent
 * business rules," every rule here was asked, not assumed):
 * - "ina apply sa mga wala pang bayad na account... kailangan before ng 1st due date lang pwede i
 *   Loan Adjust ang account" - only an ACTIVE loan (never ACTIVE_IN_ARREARS - a loan with zero
 *   payments and still before its first due date could never have fallen into arrears) with ZERO
 *   payments recorded on any installment, and only before its first installment's own due date, is
 *   eligible (`LoanNotEligibleForAdjustmentError`).
 * - Exactly once per loan account — enforced via `LoanAdjustment.oldLoanAccountId`'s unique
 *   constraint, pre-checked here for a fast, friendly error (`LoanAlreadyAdjustedError`).
 * - Purely a due-date correction: principal, interest rate, add-on rate, contractual rate,
 *   installment count, grace period, and loan product version are all copied VERBATIM from the old
 *   loan - only `firstRepaymentDate` is staff-entered/different. No new-principal formula at all
 *   (unlike Restructure), since nothing financial changes.
 * - Goes directly to ACTIVE - no approval step, same "isang click lang" posture as Restructure.
 *   Internally still passes through `LoanAccount.create()` (PENDING_APPROVAL) -> `approve()` -> the
 *   same schedule-generation/disbursement mechanics `ActivateLoanUseCase`/`RestructureLoanUseCase`
 *   use, all inside one transaction.
 * - The old loan is marked `CLOSED_ADJUSTED` (`LoanAccount.adjustClose()`) - balances are left
 *   untouched/frozen (they were never disbursed against in the first place, since zero payments
 *   means the schedule was never even due). The DISBURSEMENT `LoanTransaction` on the new loan is
 *   tagged `paymentMethod: 'ADJUSTMENT'` so it's traceable in the ledger too.
 * - MIS/Accounting-only - enforced at the HTTP layer (`loanAccountRouter.ts`), not here, same
 *   division of concerns as every other role-gated use case in this codebase.
 */
export class AdjustLoanUseCase {
  constructor(private readonly deps: AdjustLoanUseCaseDeps) {}

  async execute(input: AdjustLoanInput): Promise<{ oldLoanAccount: LoanAccount; newLoanAccount: LoanAccount }> {
    const oldLoanAccount = await this.deps.loanAccountRepository.findById(input.oldLoanAccountId);
    if (!oldLoanAccount) {
      throw new NotFoundError('LoanAccount', input.oldLoanAccountId);
    }

    if (oldLoanAccount.status !== 'ACTIVE') {
      throw new LoanNotEligibleForAdjustmentError(oldLoanAccount.id, `status is ${oldLoanAccount.status}, must be ACTIVE`);
    }

    const alreadyAdjusted = await this.deps.loanAdjustmentRepository.findByOldLoanAccountId(oldLoanAccount.id);
    if (alreadyAdjusted) {
      throw new LoanAlreadyAdjustedError(oldLoanAccount.id);
    }

    const installments = await this.deps.repaymentInstallmentRepository.findByLoanAccountId(oldLoanAccount.id);
    const hasAnyPayment = installments.some((i) => !i.paid.total().isZero());
    if (hasAnyPayment) {
      throw new LoanNotEligibleForAdjustmentError(oldLoanAccount.id, 'a payment has already been recorded on this loan - adjustment is only for accounts with zero payments made');
    }

    const now = new Date();
    const firstInstallmentDueDate = installments.reduce<Date | null>(
      (earliest, i) => (earliest === null || i.dueDate < earliest ? i.dueDate : earliest),
      null,
    );
    if (firstInstallmentDueDate !== null && now >= firstInstallmentDueDate) {
      throw new LoanNotEligibleForAdjustmentError(oldLoanAccount.id, 'the first installment is already due or past due - adjustment is only allowed before the first due date');
    }

    const loanProductVersion = await this.deps.loanProductRepository.findVersionById(oldLoanAccount.loanProductVersionId);
    if (!loanProductVersion) {
      throw new NotFoundError('LoanProductVersion', oldLoanAccount.loanProductVersionId);
    }
    if (loanProductVersion.interestCalculationMethod === 'FLAT') {
      throw new UnsupportedInterestCalculationMethodError(loanProductVersion.interestCalculationMethod);
    }

    const loanCode = await this.generateLoanCode(oldLoanAccount.loanProductVersionId);

    const newLoanAccount = LoanAccount.create({
      loanCode,
      borrowerId: oldLoanAccount.borrowerId,
      loanProductVersionId: oldLoanAccount.loanProductVersionId,
      branchId: oldLoanAccount.branchId,
      loanOfficerId: oldLoanAccount.loanOfficerId,
      principalAmount: oldLoanAccount.principalAmount,
      interestRate: oldLoanAccount.interestRate,
      addOnInterestRate: oldLoanAccount.addOnInterestRate,
      contractualInterestRate: oldLoanAccount.contractualInterestRate,
      installmentCount: oldLoanAccount.installmentCount,
      gracePeriodDays: oldLoanAccount.gracePeriodDays,
      firstRepaymentDate: input.firstRepaymentDate,
    });
    newLoanAccount.approve(input.adjustedByUserId);

    const { schedule } = AmortizationScheduleGenerator.generate(oldLoanAccount.principalAmount, newLoanAccount.interestRate, oldLoanAccount.installmentCount);
    const principalDue = oldLoanAccount.principalAmount;
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
      postedByUserId: input.adjustedByUserId,
      branchId: newLoanAccount.branchId,
      entryDate: activatedAt,
      paymentMethod: 'ADJUSTMENT',
      comment: `Adjusted from loan ${oldLoanAccount.loanCode}`,
    });

    const previousFirstRepaymentDate = firstInstallmentDueDate ?? oldLoanAccount.firstRepaymentDate;
    oldLoanAccount.adjustClose();

    const adjustment = LoanAdjustment.create({
      oldLoanAccountId: oldLoanAccount.id,
      newLoanAccountId: newLoanAccount.id,
      previousFirstRepaymentDate,
      newFirstRepaymentDate: input.firstRepaymentDate,
      reason: input.reason,
      adjustedByUserId: input.adjustedByUserId,
    });

    await this.deps.unitOfWork.run(async (ctx) => {
      await this.deps.loanAccountRepository.save(newLoanAccount, ctx);
      await this.deps.repaymentInstallmentRepository.saveMany(newInstallments, ctx);
      await this.deps.loanTransactionRepository.create(disbursementTransaction, ctx);
      await this.deps.loanAccountRepository.save(oldLoanAccount, ctx);
      await this.deps.loanAdjustmentRepository.create(adjustment, ctx);
      await this.deps.financialAuditLogger.log(
        {
          userId: input.adjustedByUserId,
          action: 'ADJUST_LOAN',
          entityType: 'LoanAccount',
          entityId: oldLoanAccount.id,
          previousValue: { status: 'ACTIVE', loanCode: oldLoanAccount.loanCode, firstRepaymentDate: previousFirstRepaymentDate.toISOString() },
          newValue: { status: 'CLOSED_ADJUSTED', newLoanAccountId: newLoanAccount.id, newLoanCode: newLoanAccount.loanCode, newFirstRepaymentDate: input.firstRepaymentDate.toISOString() },
        },
        ctx,
      );
    });

    if (this.deps.profileActivityLogService) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'LOAN_ACCOUNT',
        profileId: oldLoanAccount.id,
        userId: input.adjustedByUserId,
        ...ProfileActivityLogService.actions.decisionUpdated('ACTIVE', 'CLOSED_ADJUSTED', input.reason, { newLoanAccountId: newLoanAccount.id, newLoanCode: newLoanAccount.loanCode }),
      });
    }

    return { oldLoanAccount, newLoanAccount };
  }

  /** Mirrors `RestructureLoanUseCase.generateLoanCode`'s identical `{productCode}_{NNNNN}` convention. */
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
