import type { LoanSigningSession } from '../../domain/LoanSigningSession';
import type { ILoanSigningSessionRepository } from '../ports/ILoanSigningSessionRepository';

/** Staff-side (authenticated) status list for the "Send for signature" panel - newest first. */
export class ListLoanSigningSessionsUseCase {
  constructor(private readonly deps: { loanSigningSessionRepository: ILoanSigningSessionRepository }) {}

  async execute(loanAccountId: string): Promise<LoanSigningSession[]> {
    return this.deps.loanSigningSessionRepository.findManyByLoanAccountId(loanAccountId);
  }
}
