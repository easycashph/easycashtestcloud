import { NotFoundError } from '@shared/errors/DomainError';
import { LoanNote } from '../../domain/LoanNote';
import type { ILoanNoteRepository } from '../ports/ILoanNoteRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';

export interface CreateLoanNoteUseCaseDeps {
  loanNoteRepository: ILoanNoteRepository;
  loanAccountRepository: ILoanAccountRepository;
}

export class CreateLoanNoteUseCase {
  constructor(private readonly deps: CreateLoanNoteUseCaseDeps) {}

  async execute(loanAccountId: string, authorUserId: string, text: string): Promise<LoanNote> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) {
      throw new NotFoundError('LoanAccount', loanAccountId);
    }

    const note = LoanNote.create({ loanAccountId, authorUserId, text });
    await this.deps.loanNoteRepository.create(note);
    return note;
  }
}
