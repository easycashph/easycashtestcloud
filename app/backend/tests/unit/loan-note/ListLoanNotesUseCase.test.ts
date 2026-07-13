import { describe, expect, it, vi } from 'vitest';
import { ListLoanNotesUseCase } from '@modules/loan-note/application/use-cases/ListLoanNotesUseCase';
import type { ILoanNoteRepository } from '@modules/loan-note/application/ports/ILoanNoteRepository';

describe('ListLoanNotesUseCase', () => {
  it('returns whatever the repository provides, unmodified', async () => {
    const views = [
      { id: 'note-1', loanAccountId: 'loan-1', authorUserId: 'user-1', authorName: 'M. Santos', text: 'Called borrower', createdAt: new Date() },
    ];
    const loanNoteRepository: ILoanNoteRepository = { create: vi.fn(), findByLoanAccountId: vi.fn().mockResolvedValue(views) };
    const useCase = new ListLoanNotesUseCase({ loanNoteRepository });

    const result = await useCase.execute('loan-1');

    expect(result).toEqual(views);
    expect(loanNoteRepository.findByLoanAccountId).toHaveBeenCalledWith('loan-1');
  });
});
