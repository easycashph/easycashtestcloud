import type { ILoanRestructureRepository, LoanRestructureView } from '../ports/ILoanRestructureRepository';

export interface GetLoanRestructureUseCaseDeps {
  loanRestructureRepository: ILoanRestructureRepository;
}

/**
 * 2026-07-24 (Loan Restructure feature): thin read-only wrapper (D-2 precedent, same shape as
 * `GetLoanAccountUseCase`) — lets the Loan Detail page ask "did this specific loan account
 * participate in a restructure, on either side?" without the controller reaching into the
 * repository directly. Returns null when it didn't.
 */
export class GetLoanRestructureUseCase {
  constructor(private readonly deps: GetLoanRestructureUseCaseDeps) {}

  async execute(loanAccountId: string): Promise<LoanRestructureView | null> {
    return this.deps.loanRestructureRepository.findViewByLoanAccountId(loanAccountId);
  }
}
