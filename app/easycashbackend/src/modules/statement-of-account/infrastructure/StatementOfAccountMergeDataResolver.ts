import { NotFoundError, ValidationError } from '@shared/errors/DomainError';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { ICoBorrowerRepository } from '@modules/borrower/application/ports/ICoBorrowerRepository';
import type { IRepaymentInstallmentRepository } from '@modules/repayment/application/ports/IRepaymentInstallmentRepository';
import type { ILoanProductRepository } from '@modules/loan-product/application/ports/ILoanProductRepository';
import { resolveSecMc3Coverage } from '@modules/loan-account/application/services/SecMc3CoverageResolver';
import type { PenaltyComputationContext } from '@modules/repayment/domain/CurrentPenaltyResolver';
import { Money } from '@shared/domain/Money';
import { StatementOfAccountCalculator } from '../application/services/StatementOfAccountCalculator';
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
    penaltyFromDate: Date | undefined,
    penaltyToDate: Date,
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

    const coBorrower = loanAccount.coBorrowerIds[0]
      ? await this.deps.coBorrowerRepository.findById(loanAccount.coBorrowerIds[0])
      : null;

    const sortedInstallments = [...installments].sort((a, b) => a.installmentNumber - b.installmentNumber);
    const lastInstallment = sortedInstallments[sortedInstallments.length - 1];

    // 2026-07-28 (ADR-052 addendum, user-confirmed): a prospective loan's Penalty line reuses
    // `resolveComputedPenalty` (the exact same ADR-050 function the live Repayment Schedule uses)
    // instead of the flat/shared-range formula below — see `StatementOfAccountCalculator`'s own doc
    // comment. A migrated loan has no live figure to reuse, so it keeps the original manual
    // date-range path and REQUIRES `penaltyFromDate` to be supplied by the caller.
    const isProspectiveLoan = !loanAccount.legacyId;
    let livePenaltyContext: PenaltyComputationContext | undefined;
    if (isProspectiveLoan) {
      livePenaltyContext = {
        isProspectiveLoan: true,
        principalAmount: loanAccount.principalAmount,
        isSecMc3Covered: await resolveSecMc3Coverage(loanAccount, this.deps.loanProductRepository),
        maturityDate: lastInstallment?.dueDate ?? statementDate,
      };
    } else if (!penaltyFromDate) {
      throw new ValidationError('penaltyFromDate is required for a migrated loan (no live penalty on file).');
    }

    const figures = StatementOfAccountCalculator.calculate(
      sortedInstallments,
      loanAccount.contractualInterestRate,
      penaltyFromDate,
      penaltyToDate,
      accruedInterestAsOfDate,
      livePenaltyContext,
    );

    // Display-only for a prospective loan (not fed back into the computation) - the earliest
    // qualifying Past Due installment's own due date, so the printed "{PenaltyFromDate} /
    // {PenaltyToDate}" range still reads sensibly even though staff no longer enters a "from" date.
    const effectivePenaltyFromDate =
      penaltyFromDate ??
      sortedInstallments.find((i) => i.dueDate.getTime() <= penaltyToDate.getTime())?.dueDate ??
      sortedInstallments[0]?.dueDate ??
      statementDate;

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

    const mergeData: Record<string, unknown> = {
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
      PNValue: pnValue.toString(),

      CurrentAmortizationDue: figures.currentAmortizationDue.toString(),
      PastDuePrincipal: figures.pastDuePrincipal.toString(),
      PastDueInterest: figures.pastDueInterest.toString(),
      PastDuePenalty: figures.pastDuePenalty.toString(),
      // 2026-08-06 (user-reported): a printed date range next to a ₱0.00 penalty read as if a
      // penalty accrued over that period - blank instead, same as every other empty/zero merge
      // field in this template (e.g. CoBorrowerName above already blanks out when absent).
      PenaltyFromDate: figures.pastDuePenalty.isZero() ? '' : formatDate(effectivePenaltyFromDate),
      PenaltyToDate: figures.pastDuePenalty.isZero() ? '' : formatDate(penaltyToDate),
      TotalPastDue: figures.totalPastDue.toString(),
      AccruedInterest: figures.accruedInterest.toString(),
      AccruedInterestAsOfDate: formatDate(accruedInterestAsOfDate),
      CollectionFee: collectionFee.toString(),
      OtherFee: otherFee.toString(),
      TotalAmountDue: totalAmountDue.toString(),

      RemainingSchedule: figures.remainingSchedule.map((row) => ({
        DueDate: formatDate(row.dueDate),
        Principal: row.principal.toString(),
        Interest: row.interest.toString(),
        TotalDue: row.totalDue.toString(),
      })),
    };

    return { mergeData, figures, effectivePenaltyFromDate };
  }
}
