import { describe, expect, it, vi } from 'vitest';
import { DeleteLoanNoteUseCase } from '@modules/loan-note/application/use-cases/DeleteLoanNoteUseCase';
import { LoanNote } from '@modules/loan-note/domain/LoanNote';
import { NotFoundError } from '@shared/errors/DomainError';

function buildDeps() {
  const loanNoteRepository = { create: vi.fn(), findByLoanAccountId: vi.fn(), findById: vi.fn(), delete: vi.fn() };
  const auditLogger = { log: vi.fn() };
  return { loanNoteRepository, auditLogger };
}

describe('DeleteLoanNoteUseCase', () => {
  it('throws NotFoundError when the note does not exist', async () => {
    const deps = buildDeps();
    deps.loanNoteRepository.findById.mockResolvedValue(null);
    const useCase = new DeleteLoanNoteUseCase(deps);

    await expect(useCase.execute('loan-1', 'missing-note', 'mis-1')).rejects.toThrow(NotFoundError);
    expect(deps.loanNoteRepository.delete).not.toHaveBeenCalled();
    expect(deps.auditLogger.log).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the note belongs to a different loan account', async () => {
    const deps = buildDeps();
    const note = LoanNote.create({ loanAccountId: 'some-other-loan', authorUserId: 'user-1', text: 'A note' });
    deps.loanNoteRepository.findById.mockResolvedValue(note);
    const useCase = new DeleteLoanNoteUseCase(deps);

    await expect(useCase.execute('loan-1', note.id, 'mis-1')).rejects.toThrow(NotFoundError);
    expect(deps.loanNoteRepository.delete).not.toHaveBeenCalled();
  });

  it('deletes the note and records its content in the audit log before it is gone', async () => {
    const deps = buildDeps();
    const note = LoanNote.create({ loanAccountId: 'loan-1', authorUserId: 'collector-1', text: 'Borrower promised to pay Friday' });
    deps.loanNoteRepository.findById.mockResolvedValue(note);
    const useCase = new DeleteLoanNoteUseCase(deps);

    await useCase.execute('loan-1', note.id, 'mis-1');

    expect(deps.loanNoteRepository.delete).toHaveBeenCalledWith(note.id);
    expect(deps.auditLogger.log).toHaveBeenCalledTimes(1);
    const [entry] = deps.auditLogger.log.mock.calls[0] ?? [];
    expect(entry.action).toBe('DELETE_LOAN_NOTE');
    expect(entry.entityType).toBe('LoanNote');
    expect(entry.entityId).toBe(note.id);
    expect(entry.userId).toBe('mis-1');
    expect(entry.previousValue).toMatchObject({
      loanAccountId: 'loan-1',
      authorUserId: 'collector-1',
      text: 'Borrower promised to pay Friday',
    });
  });
});
