import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '@shared/errors/DomainError';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { ILoanProductRepository } from '@modules/loan-product/application/ports/ILoanProductRepository';
import type { IRepaymentInstallmentRepository } from '@modules/repayment/application/ports/IRepaymentInstallmentRepository';
import { Money } from '@shared/domain/Money';
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
 * ADR-051 §8: the concrete data source for every `{Placeholder}` name documented there. New
 * placeholders (for the remaining 9 templates, once the user works through them in Word) get
 * added here — this is the one place that needs to change, not `GenerateLoanDocumentUseCase`.
 */
export class LoanDocumentMergeDataResolver implements ILoanDocumentMergeDataResolver {
  constructor(
    private readonly deps: {
      loanAccountRepository: ILoanAccountRepository;
      borrowerRepository: IBorrowerRepository;
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

    const loanProduct = await this.deps.loanProductRepository.findById(loanProductVersion.loanProductId);
    if (!loanProduct) throw new NotFoundError('LoanProduct', loanProductVersion.loanProductId);

    const sortedInstallments = [...installments].sort((a, b) => a.installmentNumber - b.installmentNumber);
    const firstInstallment = sortedInstallments[0];
    const lastInstallment = sortedInstallments[sortedInstallments.length - 1];
    const firstInstallmentTotal = firstInstallment
      ? firstInstallment.due.principal.add(firstInstallment.due.interest).add(firstInstallment.due.fees)
      : undefined;

    const originationFees = loanAccount.originationFees;

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

    return {
      BorrowerName: borrower.name.fullName(),
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
      ProcessingFee: originationFees.processingFee.toString(),
      AdvanceInterest: originationFees.advanceInterestFee.toString(),
      AccountManagementFee: originationFees.accountManagementFee.toString(),
      DocStamp: originationFees.docStampFee.toString(),
      OutstandingBalance: originationFees.outstandingBalancePayoff.toString(),
      Others: originationFees.otherFees.toString(),
      NetProceeds: loanAccount.netProceeds.toString(),
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
    };
  }
}
