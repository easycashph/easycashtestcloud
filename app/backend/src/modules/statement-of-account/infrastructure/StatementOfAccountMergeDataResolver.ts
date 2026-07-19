import { NotFoundError } from '@shared/errors/DomainError';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { ICoBorrowerRepository } from '@modules/borrower/application/ports/ICoBorrowerRepository';
import type { IRepaymentInstallmentRepository } from '@modules/repayment/application/ports/IRepaymentInstallmentRepository';
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
    },
  ) {}

  async resolve(
    loanAccountId: string,
    soaNumber: string,
    statementDate: Date,
    penaltyAsOfDate: Date,
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

    const figures = StatementOfAccountCalculator.calculate(
      sortedInstallments,
      loanAccount.contractualInterestRate,
      penaltyAsOfDate,
      accruedInterestAsOfDate,
    );

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
      LoanDate: loanAccount.anticipatedDisbursementDate ? formatDate(loanAccount.anticipatedDisbursementDate) : '',
      Term: `${loanAccount.installmentCount} months`,
      MaturityDate: lastInstallment ? formatDate(lastInstallment.dueDate) : '',
      PNValue: pnValue.toString(),

      CurrentAmortizationDue: figures.currentAmortizationDue.toString(),
      PastDuePrincipal: figures.pastDuePrincipal.toString(),
      PastDueInterest: figures.pastDueInterest.toString(),
      PastDuePenalty: figures.pastDuePenalty.toString(),
      PenaltyAsOfDate: formatDate(penaltyAsOfDate),
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

    return { mergeData, figures };
  }
}
