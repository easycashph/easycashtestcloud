import type { GeneratedStatementOfAccountView, IGeneratedStatementOfAccountRepository } from '../ports/IGeneratedStatementOfAccountRepository';

export interface ListStatementsOfAccountUseCaseDeps {
  generatedStatementOfAccountRepository: IGeneratedStatementOfAccountRepository;
}

/** ADR-052 §3: append-only history, newest first — every past generation stays visible/downloadable, unlike the required-documents Documents tab (which only shows the latest per template). */
export class ListStatementsOfAccountUseCase {
  constructor(private readonly deps: ListStatementsOfAccountUseCaseDeps) {}

  async execute(loanAccountId: string): Promise<GeneratedStatementOfAccountView[]> {
    return this.deps.generatedStatementOfAccountRepository.findAllForLoanAccount(loanAccountId);
  }
}
