import type { ILoanCompromiseSettlementRepository, LoanCompromiseSettlementView } from '../ports/ILoanCompromiseSettlementRepository';

export interface GetLoanCompromiseSettlementUseCaseDeps {
  loanCompromiseSettlementRepository: ILoanCompromiseSettlementRepository;
}

/**
 * 2026-08-29 (Compromise Settlement feature): thin read-only wrapper, same shape as
 * `GetLoanRestructureUseCase` — lets the Loan Detail page ask "did this specific loan account
 * participate in a compromise settlement, on either side?" without the controller reaching into
 * the repository directly. Returns null when it didn't.
 */
export class GetLoanCompromiseSettlementUseCase {
  constructor(private readonly deps: GetLoanCompromiseSettlementUseCaseDeps) {}

  async execute(loanAccountId: string): Promise<LoanCompromiseSettlementView | null> {
    return this.deps.loanCompromiseSettlementRepository.findViewByLoanAccountId(loanAccountId);
  }
}
