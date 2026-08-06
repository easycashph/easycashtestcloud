import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { ILoanTransactionRepository } from '@modules/ledger/application/ports/ILoanTransactionRepository';
import type { PortalPaymentEntry } from '../dtos/PortalLoanAccountDtos';

/** How many payments the dashboard widget actually shows, after merging every loan account's own
 * recent payments together and re-sorting by date. */
const RECENT_PAYMENTS_LIMIT = 10;
/** Fetched PER loan account before merging - comfortably more than `RECENT_PAYMENTS_LIMIT` so a
 * client with several loan accounts still gets a correctly-sorted top 10 across all of them,
 * rather than an even split that could miss a loan account's most recent payment. */
const PER_LOAN_ACCOUNT_FETCH_LIMIT = 20;

export interface ListPortalRecentPaymentsUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  loanAccountRepository: ILoanAccountRepository;
  loanTransactionRepository: ILoanTransactionRepository;
}

/**
 * Dashboard "Recent Payments" widget (2026-08-06 user request) - the client's own ACTUAL posted
 * payments (ledger `LoanTransaction` rows of type `REPAYMENT`), most recent first, across every
 * one of their loan accounts. Never the schedule (see `ListPortalLoanAccountInstallmentsUseCase`
 * for that) - this is real money already received and posted.
 */
export class ListPortalRecentPaymentsUseCase {
  constructor(private readonly deps: ListPortalRecentPaymentsUseCaseDeps) {}

  async execute(portalAccountId: string): Promise<PortalPaymentEntry[]> {
    const { portalAccountRepository, loanAccountRepository, loanTransactionRepository } = this.deps;

    const account = await portalAccountRepository.findById(portalAccountId);
    if (!account?.borrowerId) return [];

    const loanAccounts = await loanAccountRepository.findMany({ borrowerId: account.borrowerId, limit: 200 });
    if (loanAccounts.length === 0) return [];

    const perLoanAccountPayments = await Promise.all(
      loanAccounts.map(async (loanAccount) => {
        const transactions = await loanTransactionRepository.findByLoanAccountId(loanAccount.id, {
          limit: PER_LOAN_ACCOUNT_FETCH_LIMIT,
          type: 'REPAYMENT',
        });
        return transactions.map((transaction) => ({ transaction, loanCode: loanAccount.loanCode }));
      }),
    );

    return perLoanAccountPayments
      .flat()
      .sort((a, b) => b.transaction.entryDate.getTime() - a.transaction.entryDate.getTime())
      .slice(0, RECENT_PAYMENTS_LIMIT)
      .map(({ transaction, loanCode }) => ({
        id: transaction.id,
        loanAccountId: transaction.loanAccountId,
        loanCode,
        entryDate: transaction.entryDate,
        amount: transaction.amount.toString(),
        principalComponent: transaction.components.principalComponent.toString(),
        interestComponent: transaction.components.interestComponent.toString(),
        feesComponent: transaction.components.feesComponent.toString(),
        penaltyComponent: transaction.components.penaltyComponent.toString(),
        orNumber: transaction.orNumber ?? null,
        paymentMethod: transaction.paymentMethod ?? null,
      }));
  }
}
