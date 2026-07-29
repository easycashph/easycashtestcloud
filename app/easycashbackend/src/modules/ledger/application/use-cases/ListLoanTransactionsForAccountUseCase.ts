import type { LoanTransaction } from '../../domain/LoanTransaction';
import type { ILoanTransactionRepository } from '../ports/ILoanTransactionRepository';

export interface ListLoanTransactionsForAccountUseCaseDeps {
  loanTransactionRepository: ILoanTransactionRepository;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Always paginated (ADR-042 §6/§11) — no "give me everything" option is offered at any layer. */
export class ListLoanTransactionsForAccountUseCase {
  constructor(private readonly deps: ListLoanTransactionsForAccountUseCaseDeps) {}

  async execute(loanAccountId: string, limit = DEFAULT_LIMIT, cursor?: string, branchId?: string): Promise<LoanTransaction[]> {
    const boundedLimit = Math.min(limit, MAX_LIMIT);
    return this.deps.loanTransactionRepository.findByLoanAccountId(loanAccountId, { limit: boundedLimit, cursor, branchId });
  }
}
