import { NotFoundError } from '@shared/errors/DomainError';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';

export interface ApproveLoanUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
}

/**
 * ADR-032: approval and activation/disbursement are separate business
 * events — this use case performs ONLY the PENDING_APPROVAL -> APPROVED
 * status transition. It does not create a LoanTransaction, does not
 * generate a RepaymentInstallment schedule, and does not touch any
 * balance field. A future ActivateLoanUseCase (once the calculation
 * engine exists) is responsible for those.
 *
 * This is also intentionally a single-aggregate operation — it does not
 * take an IUnitOfWork dependency, because it writes to LoanAccount only.
 * (The financial-write audit-logging requirement in
 * FINANCIAL_INVARIANTS.md §4 applies once this use case's audit entry is
 * wired up in a later milestone alongside the `audit` module, which is
 * out of scope for Milestone 7's build order.)
 */
export class ApproveLoanUseCase {
  constructor(private readonly deps: ApproveLoanUseCaseDeps) {}

  async execute(loanAccountId: string, approvedByUserId: string): Promise<void> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) {
      throw new NotFoundError('LoanAccount', loanAccountId);
    }

    loanAccount.approve(approvedByUserId);
    await this.deps.loanAccountRepository.save(loanAccount);
  }
}
