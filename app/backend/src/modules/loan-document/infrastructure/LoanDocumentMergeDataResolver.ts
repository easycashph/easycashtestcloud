import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '@shared/errors/DomainError';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { ICoBorrowerRepository } from '@modules/borrower/application/ports/ICoBorrowerRepository';
import type { ILoanProductRepository } from '@modules/loan-product/application/ports/ILoanProductRepository';
import type { IRepaymentInstallmentRepository } from '@modules/repayment/application/ports/IRepaymentInstallmentRepository';
import { Money } from '@shared/domain/Money';
import type { Percentage } from '@shared/domain/Percentage';
import type { ILoanDocumentMergeDataResolver } from '../application/ports/ILoanDocumentMergeDataResolver';
import { moneyToWords } from '../application/numberToWords';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDate(date: Date): string {
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/**
 * `Percentage.toString()` always returns the fixed 3-decimal storage representation (e.g.
 * "2.520", matching the `Decimal(6,3)` schema column) — trims trailing zeros for display on
 * generated documents (2026-07-14 fix: "2.520%" read wrong on the Disclosure Statement), so
 * "2.520" -> "2.52%" and "15.000" -> "15%".
 */
function formatPercentage(pct: Percentage): string {
  const raw = pct.toString();
  const trimmed = raw.includes('.') ? raw.replace(/0+$/, '').replace(/\.$/, '') : raw;
  return `${trimmed}%`;
}

/** Same "first address on file, comma-joined" convention as `ClientProfilePage.tsx`'s `existingAddressLine`. */
function formatAddress(address: { houseUnitNumber?: string; street?: string; barangay?: string; cityMunicipality?: string; province?: string } | undefined): string {
  if (!address) return '';
  return [address.houseUnitNumber, address.street, address.barangay, address.cityMunicipality, address.province]
    .filter((part): part is string => Boolean(part))
    .join(', ');
}

/**
 * ADR-051 §8: the concrete data source for every `{Placeholder}` name documented there. New
 * placeholders (for the remaining 9 templates, once the user works through them in Word) get
 * added here — this is the one place that needs to change, not `GenerateLoanDocumentUseCase`.
 */
export class LoanDocumentMergeDataResolver implements ILoanDocumentMergeDataResolver {
  constructor(
    private readonly deps: {
      loanAccountRepository: ILoanAccountRepository;
      borrowerRepository: IBorrowerRepository;
      coBorrowerRepository: ICoBorrowerRepository;
      loanProductRepository: ILoanProductRepository;
      repaymentInstallmentRepository: IRepaymentInstallmentRepository;
      prisma: PrismaClient;
    },
  ) {}

  async resolve(loanAccountId: string): Promise<Record<string, unknown>> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) throw new NotFoundError('LoanAccount', loanAccountId);

    const [borrower, loanProductVersion, installments, branch] = await Promise.all([
      this.deps.borrowerRepository.findById(loanAccount.borrowerId),
      this.deps.loanProductRepository.findVersionById(loanAccount.loanProductVersionId),
      this.deps.repaymentInstallmentRepository.findByLoanAccountId(loanAccountId),
      this.deps.prisma.branch.findUnique({ where: { id: loanAccount.branchId } }),
    ]);
    if (!borrower) throw new NotFoundError('Borrower', loanAccount.borrowerId);
    if (!loanProductVersion) throw new NotFoundError('LoanProductVersion', loanAccount.loanProductVersionId);

    // Loan Agreement templates (Salary/Seafarer) reference a Co-Borrower — most loans don't have
    // one, so this is optional (blank placeholders), not a NotFoundError like Borrower above.
    const coBorrower = loanAccount.coBorrowerIds[0]
      ? await this.deps.coBorrowerRepository.findById(loanAccount.coBorrowerIds[0])
      : null;

    const loanProduct = await this.deps.loanProductRepository.findById(loanProductVersion.loanProductId);
    if (!loanProduct) throw new NotFoundError('LoanProduct', loanProductVersion.loanProductId);

    const sortedInstallments = [...installments].sort((a, b) => a.installmentNumber - b.installmentNumber);
    const firstInstallment = sortedInstallments[0];
    const lastInstallment = sortedInstallments[sortedInstallments.length - 1];
    const firstInstallmentTotal = firstInstallment
      ? firstInstallment.due.principal.add(firstInstallment.due.interest).add(firstInstallment.due.fees)
      : undefined;

    const originationFees = loanAccount.originationFees;
    // Disclosure Statement "Miscellaneous Fee" line: not its own stored field — the business
    // definition (per user, 2026-07-14) is Notarial Fee + Web Fee + Insurance Fee combined.
    const miscellaneousFee = originationFees.notarialFee.add(originationFees.webFee).add(originationFees.insuranceFee);

    // ADR-051 (Promissory Note installment schedule table): docxtemplater repeats a table row once
    // per array entry when the template wraps that row in `{#Schedule}`/`{/Schedule}` tags.
    const installmentPaymentsDue = sortedInstallments.map((installment) =>
      installment.due.principal.add(installment.due.interest).add(installment.due.fees),
    );
    const schedule = sortedInstallments.map((installment, index) => ({
      Number: String(index + 1),
      Date: formatDate(installment.dueDate),
      PaymentDue: installmentPaymentsDue[index]!.toString(),
    }));
    const totalPaymentDue = installmentPaymentsDue.reduce((sum, due) => sum.add(due), Money.ZERO);

    // Disclosure Statement's fuller "Amortization Schedule" table (Principal/Interest/Fees/Payment
    // Due/running Balance columns, plus an opening row at disbursement showing the starting
    // balance) — distinct from the Promissory Note's simpler 3-column Schedule above.
    const amortDisbursementDate = loanAccount.activatedAt ?? loanAccount.anticipatedDisbursementDate;
    const openingRow = {
      Number: '',
      Date: amortDisbursementDate ? formatDate(amortDisbursementDate) : '',
      Principal: '',
      Interest: '',
      Fees: '',
      PaymentDue: '',
      Balance: loanAccount.principalAmount.toString(),
    };
    let runningBalance = loanAccount.principalAmount;
    const amortizationSchedule = [
      openingRow,
      ...sortedInstallments.map((installment, index) => {
        runningBalance = runningBalance.subtract(installment.due.principal);
        return {
          Number: String(index + 1),
          Date: formatDate(installment.dueDate),
          Principal: installment.due.principal.toString(),
          Interest: installment.due.interest.toString(),
          Fees: installment.due.fees.toString(),
          PaymentDue: installmentPaymentsDue[index]!.toString(),
          Balance: runningBalance.toString(),
        };
      }),
    ];
    const totalPrincipal = sortedInstallments.reduce((sum, i) => sum.add(i.due.principal), Money.ZERO);
    const totalInterest = sortedInstallments.reduce((sum, i) => sum.add(i.due.interest), Money.ZERO);
    const totalFees = sortedInstallments.reduce((sum, i) => sum.add(i.due.fees), Money.ZERO);

    return {
      BorrowerName: borrower.name.fullName(),
      Address: formatAddress(borrower.addresses[0]?.toProps()),
      CoBorrowerName: coBorrower?.name.fullName() ?? '',
      CoBorrowerAddress: formatAddress(coBorrower?.addresses[0]?.toProps()),
      // Loan Agreement (Salary/Seafarer) "enter into this Loan Agreement this ___" signing date —
      // reuses ApprovalDate's convention rather than a new field, since documents are generated at
      // APPROVED.
      AgreementDate: loanAccount.approvedAt ? formatDate(loanAccount.approvedAt) : '',
      LoanAccountId: loanAccount.loanCode,
      LoanProductName: loanProduct.name,
      ApprovalDate: loanAccount.approvedAt ? formatDate(loanAccount.approvedAt) : '',
      DisbursementDate: loanAccount.activatedAt ? formatDate(loanAccount.activatedAt) : '',
      // Documents are generated at APPROVED, before activatedAt (the real disbursement date) has a
      // value — this is the staff-entered estimate captured at loan account creation instead.
      AnticipatedDisbursementDate: loanAccount.anticipatedDisbursementDate
        ? formatDate(loanAccount.anticipatedDisbursementDate)
        : '',
      MaturityDate: lastInstallment ? formatDate(lastInstallment.dueDate) : '',
      BranchName: branch?.name ?? '',

      PrincipalAmount: loanAccount.principalAmount.toString(),
      InterestRate: formatPercentage(loanAccount.interestRate),
      ContractualRate: loanAccount.contractualInterestRate ? formatPercentage(loanAccount.contractualInterestRate) : '',
      AddOnRate: loanAccount.addOnInterestRate ? formatPercentage(loanAccount.addOnInterestRate) : '',
      ProcessingFee: originationFees.processingFee.toString(),
      AdvanceInterest: originationFees.advanceInterestFee.toString(),
      AccountManagementFee: originationFees.accountManagementFee.toString(),
      DocStamp: originationFees.docStampFee.toString(),
      OutstandingBalance: originationFees.outstandingBalancePayoff.toString(),
      Others: originationFees.otherFees.toString(),
      MiscellaneousFee: miscellaneousFee.toString(),
      NetProceeds: loanAccount.netProceeds.toString(),
      // Disclosure Statement line-item gates (2026-07-14, user request): docxtemplater renders a
      // `{#HasX}...{/HasX}`-wrapped section only when the value is truthy, so wrapping a whole
      // table row in one of these hides that row entirely when the amount is zero, rather than
      // showing a "0.00" line.
      HasPrincipalAmount: !loanAccount.principalAmount.isZero(),
      HasProcessingFee: !originationFees.processingFee.isZero(),
      HasAdvanceInterest: !originationFees.advanceInterestFee.isZero(),
      HasAccountManagementFee: !originationFees.accountManagementFee.isZero(),
      HasDocStamp: !originationFees.docStampFee.isZero(),
      HasOutstandingBalance: !originationFees.outstandingBalancePayoff.isZero(),
      HasOthers: !originationFees.otherFees.isZero(),
      HasMiscellaneousFee: !miscellaneousFee.isZero(),
      // Contractual boilerplate rates, not per-loan data — same for every Disclosure Statement.
      LateChargesRate: '15%',
      AttorneysFeeRate: '25%',
      LitigationFee: 'Actual Cost',

      PNNumber: loanAccount.loanCode,
      LoanAmountFigures: loanAccount.principalAmount.toString(),
      LoanAmountWords: moneyToWords(loanAccount.principalAmount.toDecimal()),
      InstallmentAmount: firstInstallmentTotal ? firstInstallmentTotal.toString() : '',
      NumberOfInstallments: String(loanAccount.installmentCount),
      FirstDueDate: formatDate(loanAccount.firstRepaymentDate),
      Schedule: schedule,
      TotalPaymentDue: totalPaymentDue.toString(),
      TotalPaymentDueWords: moneyToWords(totalPaymentDue.toDecimal()),
      AmortizationSchedule: amortizationSchedule,
      TotalPrincipal: totalPrincipal.toString(),
      TotalInterest: totalInterest.toString(),
      TotalFees: totalFees.toString(),
    };
  }
}
