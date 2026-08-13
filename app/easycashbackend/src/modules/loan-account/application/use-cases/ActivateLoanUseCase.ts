import { NotFoundError } from '@shared/errors/DomainError';
import { Money } from '@shared/domain/Money';
import { AmortizationScheduleGenerator } from '@shared/domain/calculation/AmortizationScheduleGenerator';
import type { IUnitOfWork } from '@shared/application/ports/IUnitOfWork';
import type { IFinancialAuditLogger } from '@shared/application/ports/IFinancialAuditLogger';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import type { IPortalAccountRepository } from '@modules/client-portal/application/ports/IPortalAccountRepository';
import type { PortalNotificationService } from '@modules/client-portal/application/PortalNotificationService';
import type { ILoanProductRepository } from '@modules/loan-product/application/ports/ILoanProductRepository';
import type { ILoanTransactionRepository } from '@modules/ledger/application/ports/ILoanTransactionRepository';
import { LoanTransaction } from '@modules/ledger/domain/LoanTransaction';
import type { IRepaymentInstallmentRepository } from '@modules/repayment/application/ports/IRepaymentInstallmentRepository';
import { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { InstallmentAmounts } from '@modules/repayment/domain/valueObjects/InstallmentAmounts';
import { LoanAccount } from '../../domain/LoanAccount';
import { UnsupportedInterestCalculationMethodError } from '../../domain/errors/LoanAccountDomainErrors';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';

export interface ActivateLoanUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  loanProductRepository: ILoanProductRepository;
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
  loanTransactionRepository: ILoanTransactionRepository;
  financialAuditLogger: IFinancialAuditLogger;
  unitOfWork: IUnitOfWork;
  profileActivityLogService?: ProfileActivityLogService;
  /** 2026-08-14 (user request) - see ApproveLoanUseCase's identical deps for the reasoning. */
  portalAccountRepository?: IPortalAccountRepository;
  portalNotificationService?: PortalNotificationService;
  userRepository?: IUserRepository;
}

/**
 * ADR-045: only `firstRepaymentDate` (the anchor) is a business decision.
 * Spacing subsequent installments by calendar months is a deterministic
 * consequence of `repaymentPeriodUnit` already being `MONTHS` (the
 * schema's only supported value), not a separate rule. Clamps to the last
 * day of the target month when the anchor day doesn't exist there (e.g.
 * Jan 31 + 1 month -> Feb 28/29) — the standard calendar-month-addition
 * convention, not a business policy.
 */
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
 * Milestone 9.1 checkpoint 8 / ADR-032: activation is disbursement — one
 * business event, several internal writes, all inside one
 * `IUnitOfWork.run()` call (ADR-032 §5, `FINANCIAL_INVARIANTS.md` §7):
 *   1. `LoanAccount.activate()` (CP7) — `APPROVED -> ACTIVE`, balance fields.
 *   2. `RepaymentInstallment` schedule generation (CP3's
 *      `AmortizationScheduleGenerator`, anchored on `LoanAccount.
 *      firstRepaymentDate` per `ADR-045`, Concept 1).
 *   3. A `DISBURSEMENT`-typed `LoanTransaction` insert.
 *   4. A financial audit log entry (CP2, fail-closed — if this throws, the
 *      whole transaction, including 1-3, rolls back; `FINANCIAL_INVARIANTS.
 *      md` §4).
 *
 * Deliberately excludes (not this checkpoint's scope):
 *   - The Advance Interest Fee (`ADR-046`) — accepted and evidenced, but
 *     which `LoanProductVersion`s should charge it is an explicit,
 *     still-open business decision (`ADR-046` §4/§5). Implementing it now
 *     would mean guessing which products are eligible.
 *   - The `outstandingBalance` summary getter (CP11) — gated on `ADR-007`
 *     §3, unrelated to this use case's balance-column writes.
 *   - Any HTTP route (CP13, future milestone) — this use case has no
 *     controller/router, following the same D-2 precedent as
 *     `RecordLoanTransactionUseCase`/`CreateRepaymentInstallmentUseCase`.
 *
 * `principalDue` is taken directly from `LoanAccount.principalAmount`
 * (the authoritative, already-known contractual figure) rather than
 * re-summing the schedule's `principalPortion`s, which can differ from it
 * by a few centavos under CP3's own acknowledged rounding-residue
 * limitation (`CALCULATION_ENGINE_SPEC.md` §7, `ROUND_REMAINDER_INTO_
 * LAST_REPAYMENT` mechanics `STATUS: UNRESOLVED`). `interestDue` has no
 * other source of truth than the generated schedule, so it is summed from
 * it. `feesDue`/`penaltyDue` are left at `activate()`'s own zero defaults
 * — no fee-application logic is invented here (see ADR-046 exclusion
 * above).
 *
 * `balanceAfter` on the `DISBURSEMENT` transaction is set to `principalDue`
 * alone — the one figure both of `ADR-007` §3's still-open candidate
 * "outstandingBalance" formulas would agree on at the exact moment of
 * disbursement (penalty is definitionally zero at this point regardless of
 * which formula eventually wins), so this does not pre-decide ADR-007.
 *
 * `monthlyContractualRate` is `LoanAccount.interestRate` directly — per
 * `ADR-010` §1 ("`MonthlyContractualRate` is the loan's stored,
 * snapshot-at-approval rate, `LoanAccount.interestRate`"), this field
 * already IS the contractual rate the amortization formula requires; no
 * ADR establishes `contractualInterestRate` as a higher-precedence source,
 * and `addOnInterestRate`/`contractualInterestRate` are both optional
 * disclosure-oriented fields (ADR-010 §1 item 3-4) that may not be
 * populated on every loan. Using either as an override/fallback here would
 * silently compute interest against the wrong rate for any loan
 * originated via the Add-On-quoted path without a mirrored
 * `contractualInterestRate` — no Add-On-to-Contractual conversion is
 * performed by this use case in any case.
 */
export class ActivateLoanUseCase {
  constructor(private readonly deps: ActivateLoanUseCaseDeps) {}

  async execute(loanAccountId: string, activatedByUserId: string): Promise<LoanAccount> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) {
      throw new NotFoundError('LoanAccount', loanAccountId);
    }

    const loanProductVersion = await this.deps.loanProductRepository.findVersionById(loanAccount.loanProductVersionId);
    if (!loanProductVersion) {
      throw new NotFoundError('LoanProductVersion', loanAccount.loanProductVersionId);
    }

    if (loanProductVersion.interestCalculationMethod === 'FLAT') {
      throw new UnsupportedInterestCalculationMethodError(loanProductVersion.interestCalculationMethod);
    }

    const monthlyContractualRate = loanAccount.interestRate;
    const { schedule } = AmortizationScheduleGenerator.generate(
      loanAccount.principalAmount,
      monthlyContractualRate,
      loanAccount.installmentCount,
    );

    const principalDue = loanAccount.principalAmount;
    const interestDue = schedule.reduce((total, entry) => total.add(entry.interestPortion), Money.ZERO);
    const activatedAt = new Date();

    loanAccount.activate({ principalDue, interestDue, activatedAt });

    const installments = schedule.map((entry) =>
      RepaymentInstallment.create({
        loanAccountId: loanAccount.id,
        installmentNumber: entry.installmentNumber,
        dueDate: addMonths(loanAccount.firstRepaymentDate, entry.installmentNumber - 1),
        due: InstallmentAmounts.of({ principal: entry.principalPortion, interest: entry.interestPortion }),
      }),
    );

    const disbursementTransaction = LoanTransaction.create({
      loanAccountId: loanAccount.id,
      type: 'DISBURSEMENT',
      amount: principalDue,
      components: { principalComponent: principalDue },
      balanceAfter: principalDue,
      postedByUserId: activatedByUserId,
      branchId: loanAccount.branchId,
      entryDate: activatedAt,
    });

    await this.deps.unitOfWork.run(async (ctx) => {
      await this.deps.loanAccountRepository.save(loanAccount, ctx);
      await this.deps.repaymentInstallmentRepository.saveMany(installments, ctx);
      await this.deps.loanTransactionRepository.create(disbursementTransaction, ctx);
      await this.deps.financialAuditLogger.log(
        {
          userId: activatedByUserId,
          action: 'ACTIVATE_LOAN',
          entityType: 'LoanAccount',
          entityId: loanAccount.id,
          previousValue: { status: 'APPROVED' },
          newValue: { status: 'ACTIVE', principalDue: principalDue.toString(), interestDue: interestDue.toString() },
        },
        ctx,
      );
    });

    // ADR-050: Log activity for profile timeline
    if (this.deps.profileActivityLogService) {
      await this.deps.profileActivityLogService.logActivity({
        profileType: 'LOAN_ACCOUNT',
        profileId: loanAccount.id,
        userId: activatedByUserId,
        ...ProfileActivityLogService.actions.decisionUpdated('APPROVED', 'ACTIVE'),
      });
    }

    // Easycash Portal Notification Center (2026-08-14 user request) - same convention as
    // ApproveLoanUseCase's notification.
    if (this.deps.portalAccountRepository && this.deps.portalNotificationService) {
      const portalAccount = await this.deps.portalAccountRepository.findByBorrowerId(loanAccount.borrowerId);
      if (portalAccount) {
        const activator = this.deps.userRepository ? await this.deps.userRepository.findById(activatedByUserId) : null;
        const activatorName = activator ? `${activator.firstName} ${activator.lastName}` : 'an Easycash loan officer';
        await this.deps.portalNotificationService.notify({
          portalAccountId: portalAccount.id,
          type: 'LOAN_ACCOUNT_DISBURSED',
          title: `LOAN ACCOUNT DISBURSED: ${loanAccount.loanCode} has been disbursed by ${activatorName}`,
          body: 'Your loan has been disbursed. Your first repayment schedule is now available on your Dashboard.',
          entityType: 'LoanAccount',
          entityId: loanAccount.id,
        });
      }
    }

    return loanAccount;
  }
}
