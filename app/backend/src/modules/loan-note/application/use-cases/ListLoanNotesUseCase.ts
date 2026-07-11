import type { ILoanNoteRepository, LoanNoteView } from '../ports/ILoanNoteRepository';

export interface ListLoanNotesUseCaseDeps {
  loanNoteRepository: ILoanNoteRepository;
}

export class ListLoanNotesUseCase {
  constructor(private readonly deps: ListLoanNotesUseCaseDeps) {}

  async execute(loanAccountId: string): Promise<LoanNoteView[]> {
    return this.deps.loanNoteRepository.findByLoanAccountId(loanAccountId);
  }
}
