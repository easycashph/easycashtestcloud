import { NotFoundError, ValidationError } from '@shared/errors/DomainError';
import { env } from '@shared/config/env';
import { Money } from '@shared/domain/Money';
import type { Percentage } from '@shared/domain/Percentage';
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
import {
  LoanAlreadyRestructuredError,
  LoanNotEligibleForRestructureError,
  NegotiatedOverrideReasonRequiredError,
  UnsupportedInterestCalculationMethodError,
} from '../../domain/errors/LoanAccountDomainErrors';
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
  /** 2026-08-20 (user-confirmed, "para sa negotiated na mas mababang principal at rate") - optional
   * staff override, only ever LOWER than the system-computed principal/original interest rate, for
   * a real out-of-band concession negotiated with the borrower. See
   * RestructureNegotiatedOverrideExceedsCeilingError's own doc comment for the ceiling rule. */
  negotiatedNewPrincipal?: Money;
  negotiatedInterestRate?: Percentage;
  /** 2026-08-27 (user-confirmed): only meaningful when the old loan's product uses FLAT interest -
   * FLAT has no verified calculation formula (`CALCULATION_ENGINE_SPEC.md` §4, `STATUS:
   * UNRESOLVED`), so restructuring one of these special accounts now offers staff an explicit
   * choice for the NEW (restructured) loan's schedule: `'DECLINING_BALANCE'` (recommended -
   * computed automatically, the same verified formula every other product uses) or `'FLAT'` (keeps
   * the same type, but staff enters the interest manually since the system can't compute it).
   * Defaults to `'DECLINING_BALANCE'` when omitted - ignored entirely for a non-FLAT old loan,
   * which always uses the normal computed path regardless. The new loan's `LoanProductVersion`
   * reference is unchanged either way - this only affects how THIS restructure's schedule is
   * computed, not the product's own definition. */
  restructureInterestMethod?: 'DECLINING_BALANCE' | 'FLAT';
  /** Required, and only accepted, when `restructureInterestMethod === 'FLAT'` - the single
   * installment's interest amount, entered by staff since the engine cannot compute it. Only ever
   * used for a single-installment restructure - the special FLAT accounts this exists for are
   * user-confirmed to always restructure to exactly one term. */
  manualFlatInterestDue?: Money;
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
 * - Product is copied from the old loan (its own LA-4 snapshot fields) — user chose NOT to let
 *   staff pick a different product. Term (`installmentCount`) and `firstRepaymentDate` ARE
 *   staff-entered, per ADR-045's "no recoverable generation rule" stance on `firstRepaymentDate`
 *   (mirrors `CreateLoanAccountUseCase`'s identical requirement).
 * - 2026-08-20 (user-confirmed): principal and interest rate default to the system-computed figure /
 *   the old loan's own rate, same as before, but staff may now optionally override EITHER with a
 *   negotiated figure — bidirectional ("pwede i pasok ng mataas or mababa hindi lang pababa"),
 *   mirroring Reduce Penalty/Adjust Fees's own "ceiling removed" precedent. Whenever the actual
 *   figure used differs from the computed default (either direction), a `reason` is REQUIRED (not
 *   merely optional like a plain restructure's reason) — see
 *   `NegotiatedOverrideReasonRequiredError`'s own doc comment.
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
    // 2026-08-20 (user-reported, BL-SPEC_00028): reuse RepaymentInstallment.status (LATE) instead
    // of re-deriving "past due" from a raw dueDate/now comparison here - keeps this in lockstep
    // with the single source of truth, including its day-of-due-date grace (see dueDateGrace.ts).
    const isPastDueOrMatured = installments.some((i) => i.status === 'LATE');
    if (!isPastDueOrMatured) {
      throw new LoanNotEligibleForRestructureError(oldLoanAccount.id, 'no past due or matured installment - only offered for past due/matured accounts');
    }

    const loanProductVersion = await this.deps.loanProductRepository.findVersionById(oldLoanAccount.loanProductVersionId);
    if (!loanProductVersion) {
      throw new NotFoundError('LoanProductVersion', oldLoanAccount.loanProductVersionId);
    }
    const isFlatProduct = loanProductVersion.interestCalculationMethod === 'FLAT';
    const useManualFlatSchedule = isFlatProduct && input.restructureInterestMethod === 'FLAT';
    if (useManualFlatSchedule) {
      if (!input.manualFlatInterestDue) {
        throw new UnsupportedInterestCalculationMethodError(loanProductVersion.interestCalculationMethod);
      }
      if (input.installmentCount !== 1) {
        throw new ValidationError('A FLAT-interest restructure only supports a single installment - staff enters the schedule manually.');
      }
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
    const computedNewPrincipal = accruedInterestFigures.restructureNewPrincipal;
    // 2026-08-20 (user-confirmed, "pwede i pasok ng mataas or mababa hindi lang pababa"): a
    // staff-entered override may raise OR lower the principal/interest rate from the
    // computed/original default - bidirectional, mirroring Reduce Penalty/Adjust Fees's own
    // "ceiling removed" precedent (see NegotiatedOverrideReasonRequiredError's own doc comment).
    // Whenever the override actually differs from the default, a reason is required - the audit
    // trail must say why, not just that it happened.
    if (input.negotiatedNewPrincipal && !input.negotiatedNewPrincipal.equals(computedNewPrincipal) && !input.reason?.trim()) {
      throw new NegotiatedOverrideReasonRequiredError('principal');
    }
    if (
      input.negotiatedInterestRate &&
      !input.negotiatedInterestRate.equals(oldLoanAccount.interestRate) &&
      !input.reason?.trim()
    ) {
      throw new NegotiatedOverrideReasonRequiredError('interest rate');
    }
    const newPrincipalAmount = input.negotiatedNewPrincipal ?? computedNewPrincipal;
    const newInterestRate = input.negotiatedInterestRate ?? oldLoanAccount.interestRate;
    const loanCode = await this.generateLoanCode(oldLoanAccount.loanProductVersionId);

    const newLoanAccount = LoanAccount.create({
      loanCode,
      borrowerId: oldLoanAccount.borrowerId,
      loanProductVersionId: oldLoanAccount.loanProductVersionId,
      branchId: oldLoanAccount.branchId,
      loanOfficerId: oldLoanAccount.loanOfficerId,
      principalAmount: newPrincipalAmount,
      interestRate: newInterestRate,
      addOnInterestRate: oldLoanAccount.addOnInterestRate,
      contractualInterestRate: newInterestRate,
      installmentCount: input.installmentCount,
      gracePeriodDays: oldLoanAccount.gracePeriodDays,
      firstRepaymentDate: input.firstRepaymentDate,
    });
    newLoanAccount.approve(input.restructuredByUserId);

    // useManualFlatSchedule: AmortizationScheduleGenerator is declining-balance-only (see
    // isFlatProduct's doc comment above) - the whole schedule is just the one manually-entered
    // installment instead. Otherwise unchanged - this also covers a FLAT product where staff chose
    // 'DECLINING_BALANCE' (the default), which simply uses the normal computed path below.
    const principalDue = newPrincipalAmount;
    let interestDue: Money;
    let newInstallments: RepaymentInstallment[];
    if (useManualFlatSchedule) {
      interestDue = input.manualFlatInterestDue!;
      newInstallments = [
        RepaymentInstallment.create({
          loanAccountId: newLoanAccount.id,
          installmentNumber: 1,
          dueDate: input.firstRepaymentDate,
          due: InstallmentAmounts.of({ principal: principalDue, interest: interestDue }),
        }),
      ];
    } else {
      const { schedule } = AmortizationScheduleGenerator.generate(newPrincipalAmount, newLoanAccount.interestRate, input.installmentCount);
      interestDue = schedule.reduce((total, entry) => total.add(entry.interestPortion), Money.ZERO);
      newInstallments = schedule.map((entry) =>
        RepaymentInstallment.create({
          loanAccountId: newLoanAccount.id,
          installmentNumber: entry.installmentNumber,
          dueDate: addMonths(input.firstRepaymentDate, entry.installmentNumber - 1),
          due: InstallmentAmounts.of({ principal: entry.principalPortion, interest: entry.interestPortion }),
        }),
      );
    }
    const activatedAt = new Date();
    newLoanAccount.activate({ principalDue, interestDue, activatedAt });

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
      // 2026-08-20 (negotiated restructure): now genuinely distinct when a negotiated override was
      // used - previousCollectionsBalance keeps the system-COMPUTED figure (what was actually
      // owed), newPrincipalAmount is what the new loan was actually opened with (the negotiated,
      // possibly lower, figure) - a meaningful before/after for the audit trail. Identical when no
      // override was given, same as before this feature.
      previousCollectionsBalance: computedNewPrincipal,
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
