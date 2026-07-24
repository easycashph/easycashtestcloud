import type { ILoanAdjustmentRepository, LoanAdjustmentView } from '../ports/ILoanAdjustmentRepository';

export interface GetLoanAdjustmentUseCaseDeps {
  loanAdjustmentRepository: ILoanAdjustmentRepository;
}

/**
 * 2026-07-24 (Loan Adjustment feature): thin read-only wrapper, same shape as
 * `GetLoanRestructureUseCase` — lets the Loan Detail page ask "did this specific loan account
 * participate in an adjustment, on either side?" without the controller reaching into the
 * repository directly. Returns null when it didn't.
 */
export class GetLoanAdjustmentUseCase {
  constructor(private readonly deps: GetLoanAdjustmentUseCaseDeps) {}

  async execute(loanAccountId: string): Promise<LoanAdjustmentView | null> {
    return this.deps.loanAdjustmentRepository.findViewByLoanAccountId(loanAccountId);
  }
}
