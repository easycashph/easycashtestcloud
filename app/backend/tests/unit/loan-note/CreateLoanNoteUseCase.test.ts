import { describe, expect, it, vi } from 'vitest';
import { CreateLoanNoteUseCase } from '@modules/loan-note/application/use-cases/CreateLoanNoteUseCase';
import { LoanAccount } from '@modules/loan-account/domain/LoanAccount';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { NotFoundError } from '@shared/errors/DomainError';

function buildLoan() {
  return LoanAccount.create({
    loanCode: 'LN-0001',
    borrowerId: 'borrower-1',
    loanProductVersionId: 'version-1',
    branchId: 'branch-1',
    principalAmount: Money.of('10000.00'),
    interestRate: Percentage.of('2.5'),
    installmentCount: 6,
    firstRepaymentDate: new Date('2026-08-15'),
  });
}

describe('CreateLoanNoteUseCase', () => {
  it('throws NotFoundError when the loan account does not exist', async () => {
    const loanNoteRepository = { create: vi.fn(), findByLoanAccountId: vi.fn() };
    const loanAccountRepository = { findById: vi.fn().mockResolvedValue(null), findByLoanCode: vi.fn(), findMany: vi.fn(), save: vi.fn() };
    const useCase = new CreateLoanNoteUseCase({ loanNoteRepository, loanAccountRepository });

    await expect(useCase.execute('missing-loan', 'user-1', 'A note')).rejects.toThrow(NotFoundError);
    expect(loanNoteRepository.create).not.toHaveBeenCalled();
  });

  it('creates and persists a note tied to the loan account and author', async () => {
    const loanNoteRepository = { create: vi.fn(), findByLoanAccountId: vi.fn() };
    const loanAccountRepository = { findById: vi.fn().mockResolvedValue(buildLoan()), findByLoanCode: vi.fn(), findMany: vi.fn(), save: vi.fn() };
    const useCase = new CreateLoanNoteUseCase({ loanNoteRepository, loanAccountRepository });

    const note = await useCase.execute('loan-1', 'user-1', 'Borrower agreed to pay by Friday');

    expect(note.loanAccountId).toBe('loan-1');
    expect(note.authorUserId).toBe('user-1');
    expect(note.text).toBe('Borrower agreed to pay by Friday');
    expect(loanNoteRepository.create).toHaveBeenCalledWith(note);
  });
});
