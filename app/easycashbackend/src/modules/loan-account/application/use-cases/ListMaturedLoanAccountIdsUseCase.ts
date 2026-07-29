import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';

/** Thin wrapper so `LoanAccountController` never touches the repository directly (CLAUDE.md
 * §Architecture) - computes which of a given set of loan accounts have "Matured" (per
 * Investopedia's definition: full scheduled term over, still unpaid), for the `isMatured` flag
 * on `GET /loan-accounts` and `GET /loan-accounts/:id`. */
export class ListMaturedLoanAccountIdsUseCase {
  constructor(private readonly deps: { loanAccountRepository: ILoanAccountRepository }) {}

  async execute(loanAccountIds: string[]): Promise<Set<string>> {
    return this.deps.loanAccountRepository.findMaturedLoanAccountIds(loanAccountIds);
  }
}
