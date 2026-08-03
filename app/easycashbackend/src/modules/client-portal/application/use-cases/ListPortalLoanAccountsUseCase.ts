import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { PortalLoanAccountSummary } from '../dtos/PortalLoanAccountDtos';

export interface ListPortalLoanAccountsUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  loanAccountRepository: ILoanAccountRepository;
}

/** Backs the Portal dashboard's "My Loans" section (2026-07-31 user request). Only ever returns
 * something once staff has linked the account to a real `Borrower` AND booked at least one
 * `LoanAccount` for them - an unlinked applicant (still pre-approval/under review) always gets an
 * empty list, never a fabricated placeholder. */
export class ListPortalLoanAccountsUseCase {
  constructor(private readonly deps: ListPortalLoanAccountsUseCaseDeps) {}

  async execute(portalAccountId: string): Promise<PortalLoanAccountSummary[]> {
    const account = await this.deps.portalAccountRepository.findById(portalAccountId);
    if (!account?.borrowerId) return [];

    const loanAccounts = await this.deps.loanAccountRepository.findMany({ borrowerId: account.borrowerId, limit: 50 });
    return loanAccounts.map((loanAccount) => ({
      id: loanAccount.id,
      loanCode: loanAccount.loanCode,
      status: loanAccount.status,
      principalAmount: loanAccount.principalAmount.toString(),
      outstandingBalance: loanAccount.collectionsBalance.toString(),
      contractualInterestRate: loanAccount.contractualInterestRate?.toString() ?? null,
      installmentCount: loanAccount.installmentCount,
      firstRepaymentDate: loanAccount.firstRepaymentDate,
      activatedAt: loanAccount.activatedAt ?? null,
    }));
  }
}
