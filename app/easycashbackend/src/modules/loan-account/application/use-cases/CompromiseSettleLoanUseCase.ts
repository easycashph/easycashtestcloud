import { NotFoundError } from '@shared/errors/DomainError';
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
import { LoanCompromiseSettlement } from '../../domain/LoanCompromiseSettlement';
import {
  CompromiseSettlementRequiresSameBorrowerError,
  LoanAlreadyInCompromiseSettlementError,
  LoanNotEligibleForCompromiseSettlementError,
} from '../../domain/errors/LoanAccountDomainErrors';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';
import type { ILoanCompromiseSettlementRepository } from '../ports/ILoanCompromiseSettlementRepository';

export interface CompromiseSettleLoanUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  loanProductRepository: ILoanProductRepository;
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
  loanTransactionRepository: ILoanTransactionRepository;
  loanCompromiseSettlementRepository: ILoanCompromiseSettlementRepository;
  financialAuditLogger: IFinancialAuditLogger;
  unitOfWork: IUnitOfWork;
  profileActivityLogService?: ProfileActivityLogService;
}

export interface CompromiseSettleLoanInput {
  oldLoanAccountIds: string[];
  loanProductVersionId: string;
  installmentCount: number;
  firstRepaymentDate: Date;
  /** 2026-08-29 (user-confirmed, "staff ang mag-type ng eksaktong halaga"): the negotiated
   * write-down amount, entered directly by staff - NEVER computed here, unlike Restructure's
   * computed-then-optionally-overridden principal. A compromise settlement is the result of an
   * off-system negotiation with the borrower; only staff knows the real agreed figure. */
  settlementAmount: Money;
  /** Explicit staff input, same as `CreateLoanAccountUseCase` - `LoanProductVersion.defaultInterestRate`
   * is optional and never silently substituted here (no product-derived fabrication). */
  interestRate: Percentage;
  gracePeriodDays: number;
  reason?: string;
  settledByUserId: string;
}

/** Mirrors RestructureLoanUseCase's identical, non-exported helper - see that file's own comment
 * for why it's duplicated rather than imported (keeps this whole action one atomic transaction). */
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
 * 2026-08-29 (Compromise Settlement feature, user-confirmed business rules — CLAUDE.md "never
 * invent business rules," every rule here was asked, not assumed. Grew out of migrating SDevTech's
 * own "Compromise Agreement" closure reason — see migrate-legacy-data.ts/
 * backfill-loan-restructure-compromise.ts for the historical/migrated side of this same concept):
 * - Folds ONE OR MORE old loans (staff-selected, from the Client Profile page) into ONE brand new
 *   loan. Every old loan must be ACTIVE/ACTIVE_IN_ARREARS (no "past due" requirement, unlike
 *   Restructure - a compromise is a negotiated settlement, not necessarily delinquency-triggered)
 *   and belong to the SAME borrower.
 * - Exactly once per old loan account — enforced via `LoanCompromiseSettlementItem.oldLoanAccountId`'s
 *   unique constraint, pre-checked here for a fast, friendly error.
 * - The new loan's product, term (`installmentCount`), and `firstRepaymentDate` are ALL
 *   staff-entered (unlike Restructure, which copies the old loan's own product) - a compromise may
 *   deliberately move the borrower onto a different product (e.g. a dedicated "OTH-Compromise"-style
 *   product).
 * - The new loan's principal is the staff-entered `settlementAmount` — never computed. Its
 *   schedule (principal/interest split across installments) is still generated the normal way via
 *   `AmortizationScheduleGenerator`, using the chosen product version's own interest rate - same
 *   mechanism `RestructureLoanUseCase` already uses to turn a payoff figure into a real amortized
 *   loan.
 * - Goes directly to ACTIVE — no approval step (user-confirmed: "isang click", same as Restructure).
 * - Every old loan is marked `CLOSED_COMPROMISED` (`LoanAccount.compromiseClose()`) — balances left
 *   untouched/frozen, nothing was actually collected or written off, just moved to the new account.
 * - Same permission as Restructure (`loan_account.restructure`) — enforced at the HTTP layer, user-
 *   confirmed no separate permission code needed.
 */
export class CompromiseSettleLoanUseCase {
  constructor(private readonly deps: CompromiseSettleLoanUseCaseDeps) {}

  async execute(input: CompromiseSettleLoanInput): Promise<{ oldLoanAccounts: LoanAccount[]; newLoanAccount: LoanAccount }> {
    if (input.oldLoanAccountIds.length === 0) {
      throw new LoanNotEligibleForCompromiseSettlementError('(none selected)', 'at least one old loan account must be selected');
    }

    const oldLoanAccounts: LoanAccount[] = [];
    for (const id of input.oldLoanAccountIds) {
      const loan = await this.deps.loanAccountRepository.findById(id);
      if (!loan) {
        throw new NotFoundError('LoanAccount', id);
      }
      if (loan.status !== 'ACTIVE' && loan.status !== 'ACTIVE_IN_ARREARS') {
        throw new LoanNotEligibleForCompromiseSettlementError(loan.id, `status is ${loan.status}, must be ACTIVE or ACTIVE_IN_ARREARS`);
      }
      const alreadySettled = await this.deps.loanCompromiseSettlementRepository.findByOldLoanAccountId(loan.id);
      if (alreadySettled) {
        throw new LoanAlreadyInCompromiseSettlementError(loan.id);
      }
      oldLoanAccounts.push(loan);
    }

    const borrowerId = oldLoanAccounts[0]!.borrowerId;
    if (oldLoanAccounts.some((loan) => loan.borrowerId !== borrowerId)) {
      throw new CompromiseSettlementRequiresSameBorrowerError();
    }

    const loanProductVersion = await this.deps.loanProductRepository.findVersionById(input.loanProductVersionId);
    if (!loanProductVersion) {
      throw new NotFoundError('LoanProductVersion', input.loanProductVersionId);
    }

    const loanCode = await this.generateLoanCode(input.loanProductVersionId);
    const newLoanAccount = LoanAccount.create({
      loanCode,
      borrowerId,
      loanProductVersionId: input.loanProductVersionId,
      branchId: oldLoanAccounts[0]!.branchId,
      loanOfficerId: oldLoanAccounts[0]!.loanOfficerId,
      principalAmount: input.settlementAmount,
      interestRate: input.interestRate,
      contractualInterestRate: input.interestRate,
      installmentCount: input.installmentCount,
      gracePeriodDays: input.gracePeriodDays,
      firstRepaymentDate: input.firstRepaymentDate,
    });
    newLoanAccount.approve(input.settledByUserId);

    const principalDue = input.settlementAmount;
    const { schedule } = AmortizationScheduleGenerator.generate(input.settlementAmount, newLoanAccount.interestRate, input.installmentCount);
    const interestDue = schedule.reduce((total, entry) => total.add(entry.interestPortion), Money.ZERO);
    const newInstallments: RepaymentInstallment[] = schedule.map((entry) =>
      RepaymentInstallment.create({
        loanAccountId: newLoanAccount.id,
        installmentNumber: entry.installmentNumber,
        dueDate: addMonths(input.firstRepaymentDate, entry.installmentNumber - 1),
        due: InstallmentAmounts.of({ principal: entry.principalPortion, interest: entry.interestPortion }),
      }),
    );
    const activatedAt = new Date();
    newLoanAccount.activate({ principalDue, interestDue, activatedAt });

    const oldLoanCodes = oldLoanAccounts.map((loan) => loan.loanCode).join(', ');
    const disbursementTransaction = LoanTransaction.create({
      loanAccountId: newLoanAccount.id,
      type: 'DISBURSEMENT',
      amount: principalDue,
      components: { principalComponent: principalDue },
      balanceAfter: principalDue,
      postedByUserId: input.settledByUserId,
      branchId: newLoanAccount.branchId,
      entryDate: activatedAt,
      paymentMethod: 'COMPROMISE_SETTLEMENT',
      comment: `Compromise settlement consolidating loan(s): ${oldLoanCodes}`,
    });

    // Frozen as of the moment of settlement - see LoanCompromiseSettlement's own doc comment.
    // Same "principal + interest + fees + penalty" Collections Balance shape used throughout this
    // codebase (RestructureLoanUseCase, backfill-loan-restructure-compromise.ts) - purely a display/
    // audit figure here, never fed back into settlementAmount (which is staff-entered, see above).
    const settlement = LoanCompromiseSettlement.create({
      newLoanAccountId: newLoanAccount.id,
      settlementAmount: input.settlementAmount,
      reason: input.reason,
      settledByUserId: input.settledByUserId,
      items: oldLoanAccounts.map((loan) => ({
        oldLoanAccountId: loan.id,
        previousCollectionsBalance: loan.collectionsBalance,
      })),
    });

    for (const loan of oldLoanAccounts) {
      loan.compromiseClose();
    }

    await this.deps.unitOfWork.run(async (ctx) => {
      await this.deps.loanAccountRepository.save(newLoanAccount, ctx);
      await this.deps.repaymentInstallmentRepository.saveMany(newInstallments, ctx);
      await this.deps.loanTransactionRepository.create(disbursementTransaction, ctx);
      for (const loan of oldLoanAccounts) {
        await this.deps.loanAccountRepository.save(loan, ctx);
      }
      await this.deps.loanCompromiseSettlementRepository.create(settlement, ctx);
      await this.deps.financialAuditLogger.log(
        {
          userId: input.settledByUserId,
          action: 'COMPROMISE_SETTLE_LOAN',
          entityType: 'LoanAccount',
          entityId: newLoanAccount.id,
          previousValue: { oldLoanAccountIds: input.oldLoanAccountIds, oldLoanCodes },
          newValue: {
            status: 'ACTIVE',
            newLoanCode: newLoanAccount.loanCode,
            settlementAmount: input.settlementAmount.toString(),
          },
        },
        ctx,
      );
    });

    if (this.deps.profileActivityLogService) {
      for (const loan of oldLoanAccounts) {
        await this.deps.profileActivityLogService.logActivity({
          profileType: 'LOAN_ACCOUNT',
          profileId: loan.id,
          userId: input.settledByUserId,
          ...ProfileActivityLogService.actions.decisionUpdated(loan.status, 'CLOSED_COMPROMISED', input.reason, {
            newLoanAccountId: newLoanAccount.id,
            newLoanCode: newLoanAccount.loanCode,
          }),
        });
      }
    }

    return { oldLoanAccounts, newLoanAccount };
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
