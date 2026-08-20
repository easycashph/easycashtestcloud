import { NotFoundError, ValidationError } from '@shared/errors/DomainError';
import { env } from '@shared/config/env';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { ICoBorrowerRepository } from '@modules/borrower/application/ports/ICoBorrowerRepository';
import type { IRepaymentInstallmentRepository } from '@modules/repayment/application/ports/IRepaymentInstallmentRepository';
import type { ILoanProductRepository } from '@modules/loan-product/application/ports/ILoanProductRepository';
import { resolveSecMc3Coverage } from '@modules/loan-account/application/services/SecMc3CoverageResolver';
import type { PenaltyComputationContext } from '@modules/repayment/domain/CurrentPenaltyResolver';
import { Money } from '@shared/domain/Money';
import { StatementOfAccountCalculator } from '../application/services/StatementOfAccountCalculator';
import type { SoaPenaltyMode } from '../domain/GeneratedStatementOfAccount';
import type {
  IStatementOfAccountMergeDataResolver,
  StatementOfAccountResolveResult,
} from '../application/ports/IStatementOfAccountMergeDataResolver';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDate(date: Date): string {
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/** 2026-08-06 (user-reported): the printed SOA showed raw `Money.toString()` figures ("25583.92")
 * with no thousands separator - hard to read at a glance on a document meant for a borrower.
 * Deliberately NOT a change to `Money.toString()` itself (used elsewhere for persistence/API
 * payloads that must stay machine-parseable) - comma-grouping is print-display-only, scoped to
 * this resolver's own merge data. */
function formatMoney(money: Money): string {
  return Number(money.toString()).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Same "first address on file, comma-joined" convention as `LoanDocumentMergeDataResolver.ts`/`ClientProfilePage.tsx`. */
function formatAddress(address: { houseUnitNumber?: string; street?: string; barangay?: string; cityMunicipality?: string; province?: string } | undefined): string {
  if (!address) return '';
  return [address.houseUnitNumber, address.street, address.barangay, address.cityMunicipality, address.province]
    .filter((part): part is string => Boolean(part))
    .join(', ');
}

/**
 * `docs/Architecture/ADR-052-statement-of-account-generation.md` — the concrete data source for
 * every `{Placeholder}` name on the SOA template. Mirrors `LoanDocumentMergeDataResolver`'s role
 * for the other 11 documents, but computes its own figures (via `StatementOfAccountCalculator`)
 * rather than merely formatting stored fields, since the SOA's Past Due/Accrued Interest lines
 * don't exist anywhere else in the system.
 */
export class StatementOfAccountMergeDataResolver implements IStatementOfAccountMergeDataResolver {
  constructor(
    private readonly deps: {
      loanAccountRepository: ILoanAccountRepository;
      borrowerRepository: IBorrowerRepository;
      coBorrowerRepository: ICoBorrowerRepository;
      repaymentInstallmentRepository: IRepaymentInstallmentRepository;
      loanProductRepository: ILoanProductRepository;
    },
  ) {}

  async resolve(
    loanAccountId: string,
    soaNumber: string,
    statementDate: Date,
    penaltyMode: SoaPenaltyMode,
    penaltyFromDate: Date | undefined,
    penaltyToDate: Date | undefined,
    penaltyRecomputeAll: boolean,
    manualPenaltyAmount: Money | undefined,
    accruedInterestAsOfDate: Date,
    collectionFee: Money,
    otherFee: Money,
  ): Promise<StatementOfAccountResolveResult> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) throw new NotFoundError('LoanAccount', loanAccountId);

    const [borrower, installments] = await Promise.all([
      this.deps.borrowerRepository.findById(loanAccount.borrowerId),
      this.deps.repaymentInstallmentRepository.findByLoanAccountId(loanAccountId),
    ]);
    if (!borrower) throw new NotFoundError('Borrower', loanAccount.borrowerId);

    // 2026-08-07 (user-reported): two different, non-overlapping co-borrower linkage mechanisms
    // exist in the live data - a per-LOAN join (`loanAccount.coBorrowerIds`, what every
    // CP12-migrated co-borrower uses) and a per-BORROWER direct attachment (what Client Profile's
    // "Add Co-Borrower" - ADR-015 - actually creates). Same fallback LoanDetailPage.tsx's
    // e-signature default-fill already applies: try the loan-level join first, fall back to the
    // client's directly-attached co-borrower if this loan has no join row, so a co-borrower added
    // via Client Profile still shows up on this loan's printed SOA.
    const coBorrower = loanAccount.coBorrowerIds[0]
      ? await this.deps.coBorrowerRepository.findById(loanAccount.coBorrowerIds[0])
      : (await this.deps.coBorrowerRepository.findByBorrowerId(loanAccount.borrowerId))[0] ?? null;

    const sortedInstallments = [...installments].sort((a, b) => a.installmentNumber - b.installmentNumber);
    const lastInstallment = sortedInstallments[sortedInstallments.length - 1];

    // 2026-08-12 (user-confirmed): built for BOTH loan types now, not just prospective ones —
    // `resolveComputedPenalty` reads `isProspectiveLoan` to choose between the live ADR-050 figure
    // and the migrated loan's frozen `due.penalty`, so one context serves both and `RECORDED` mode
    // works uniformly. (Previously only prospective loans got a context, which is why migrated
    // loans had no way to reach their own recorded penalty from here.)
    const isProspectiveLoan = !loanAccount.legacyId;
    const penaltyContext: PenaltyComputationContext = {
      isProspectiveLoan,
      autoComputeEnabled: env.PENALTY_AUTO_COMPUTE_ENABLED,
      principalAmount: loanAccount.principalAmount,
      isSecMc3Covered: isProspectiveLoan ? await resolveSecMc3Coverage(loanAccount, this.deps.loanProductRepository) : false,
      maturityDate: lastInstallment?.dueDate ?? statementDate,
    };

    if (penaltyMode === 'COMPUTED' && (!penaltyFromDate || !penaltyToDate)) {
      throw new ValidationError('penaltyFromDate and penaltyToDate are required when the penalty mode is COMPUTED.');
    }
    if (penaltyMode === 'MANUAL' && !manualPenaltyAmount) {
      throw new ValidationError('A penalty amount is required when the penalty mode is MANUAL.');
    }

    const figures = StatementOfAccountCalculator.calculate({
      installments: sortedInstallments,
      contractualRate: loanAccount.contractualInterestRate,
      penaltyMode,
      penaltyFromDate,
      penaltyToDate,
      penaltyRecomputeAll: penaltyMode === 'COMPUTED' ? penaltyRecomputeAll : false,
      manualPenaltyAmount,
      accruedInterestAsOfDate,
      penaltyContext,
    });

    // Printed range. `RECORDED` has no range to print at all (staff entered none); `COMPUTED`
    // prints exactly what they entered.
    const effectivePenaltyFromDate = penaltyMode === 'COMPUTED' ? penaltyFromDate ?? null : null;
    const effectivePenaltyToDate = penaltyMode === 'COMPUTED' ? penaltyToDate ?? null : null;
    const effectivePenaltyRecomputeAll = penaltyMode === 'COMPUTED' && penaltyRecomputeAll;

    // PN Amount (`btnCreateSOA_Click`'s `totalObligation`) = Principal + Interest summed across the
    // ENTIRE original schedule (not just unpaid amounts, and excluding fees) — the loan's total
    // repayment obligation over its life, not `LoanAccount.principalAmount` alone (corrected
    // 2026-07-19 after the user shared the actual VBA source; same computation already used as
    // `TotalPrincipal`/`TotalInterest` in `LoanDocumentMergeDataResolver`).
    const pnValue = sortedInstallments.reduce(
      (sum, installment) => sum.add(installment.due.principal).add(installment.due.interest),
      Money.ZERO,
    );

    const totalAmountDue = figures.totalPastDue
      .add(figures.currentAmortizationDue)
      .add(figures.accruedInterest)
      .add(collectionFee)
      .add(otherFee);

    // 2026-08-06 (user-confirmed): the Remaining Amortization table only makes sense while the
    // loan still has installments ahead of it - once past its own full maturity date (same
    // "latest installment due date" basis as the "Matured" badge/AccruedInterestCalculator), every
    // row in it is already past due and already accounted for in the Past Due section above, so
    // printing it again is redundant/confusing. Hidden via docxtemplater's `{#ShowRemainingSchedule}`
    // conditional block wrapping that whole section in the template.
    const showRemainingSchedule = !lastInstallment || lastInstallment.dueDate.getTime() >= statementDate.getTime();

    const mergeData: Record<string, unknown> = {
      // 2026-08-12: the template picks between printing a bare "Penalty" heading and
      // "Penalty {FromDate} / {ToDate}" via this flag. It is now keyed on the penalty MODE rather
      // than on whether the loan is prospective: only `COMPUTED` has a staff-entered range worth
      // printing, and that is true for a migrated and a prospective loan alike. (Superseded the
      // 2026-08-06 `IsProspectiveLoan` flag, which encoded the same intent back when loan type and
      // "did staff enter a range" happened to coincide.) Kept under the old name so the existing
      // .docx template keeps working unchanged.
      IsProspectiveLoan: penaltyMode === 'RECORDED',
      StatementDate: formatDate(statementDate),
      BorrowerName: borrower.name.fullName(),
      BorrowerAddress: formatAddress(borrower.addresses[0]?.toProps()),
      CoBorrowerName: coBorrower?.name.fullName() ?? '',
      CoBorrowerAddress: formatAddress(coBorrower?.addresses[0]?.toProps()),
      SOANumber: soaNumber,
      PNNumber: loanAccount.loanCode,
      LoanDate: (() => {
        const loanDate = loanAccount.anticipatedDisbursementDate ?? loanAccount.activatedAt;
        return loanDate ? formatDate(loanDate) : '';
      })(),
      Term: `${loanAccount.installmentCount} months`,
      MaturityDate: lastInstallment ? formatDate(lastInstallment.dueDate) : '',
      PNValue: formatMoney(pnValue),

      CurrentAmortizationDue: formatMoney(figures.currentAmortizationDue),
      PastDuePrincipal: formatMoney(figures.pastDuePrincipal),
      PastDueInterest: formatMoney(figures.pastDueInterest),
      PastDuePenalty: formatMoney(figures.pastDuePenalty),
      // 2026-08-06 (user-reported): a printed date range next to a ₱0.00 penalty read as if a
      // penalty accrued over that period - blank instead, same as every other empty/zero merge
      // field in this template (e.g. CoBorrowerName above already blanks out when absent).
      PenaltyFromDate:
        figures.pastDuePenalty.isZero() || !effectivePenaltyFromDate ? '' : formatDate(effectivePenaltyFromDate),
      PenaltyToDate: figures.pastDuePenalty.isZero() || !effectivePenaltyToDate ? '' : formatDate(effectivePenaltyToDate),
      TotalPastDue: formatMoney(figures.totalPastDue),
      AccruedInterest: formatMoney(figures.accruedInterest),
      // 2026-08-06 (user-confirmed): same rule as PenaltyFromDate/PenaltyToDate above - a date next
      // to a ₱0.00 accrued interest read as if interest accrued over that period when it didn't.
      AccruedInterestAsOfDate: figures.accruedInterest.isZero() ? '' : formatDate(accruedInterestAsOfDate),
      CollectionFee: formatMoney(collectionFee),
      OtherFee: formatMoney(otherFee),
      TotalAmountDue: formatMoney(totalAmountDue),

      ShowRemainingSchedule: showRemainingSchedule,
      RemainingSchedule: figures.remainingSchedule.map((row) => ({
        DueDate: formatDate(row.dueDate),
        Principal: formatMoney(row.principal),
        Interest: formatMoney(row.interest),
        TotalDue: formatMoney(row.totalDue),
      })),
    };

    return { mergeData, figures, effectivePenaltyFromDate, effectivePenaltyToDate, effectivePenaltyRecomputeAll };
  }
}
