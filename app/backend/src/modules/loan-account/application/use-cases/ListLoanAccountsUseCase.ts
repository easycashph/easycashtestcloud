import type { LoanAccount, LoanAccountStatus } from '../../domain/LoanAccount';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';

export interface ListLoanAccountsUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
}

export interface ListLoanAccountsInput {
  limit: number;
  cursor?: string;
  /** Milestone 8.1 / H-1: set for a branch-scoped caller, omitted for a global caller. */
  branchId?: string;
  search?: string;
  /** Frontend↔Backend Wiring Pilot follow-up (2026-07-09): filters to one borrower's loan history. */
  borrowerId?: string;
  status?: LoanAccountStatus;
  loanProductVersionIds?: string[];
}

export class ListLoanAccountsUseCase {
  constructor(private readonly deps: ListLoanAccountsUseCaseDeps) {}

  async execute(input: ListLoanAccountsInput): Promise<LoanAccount[]> {
    return this.deps.loanAccountRepository.findMany(input);
  }
}
