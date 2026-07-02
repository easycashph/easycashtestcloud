import { describe, expect, it, vi } from 'vitest';
import { CreateLoanAccountUseCase } from '@modules/loan-account/application/use-cases/CreateLoanAccountUseCase';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';

describe('CreateLoanAccountUseCase', () => {
  it('creates a PENDING_APPROVAL loan account with the given terms', async () => {
    const loanAccountRepository: ILoanAccountRepository = { findById: vi.fn(), findByLoanCode: vi.fn(), save: vi.fn() };
    const useCase = new CreateLoanAccountUseCase({ loanAccountRepository });

    const loan = await useCase.execute({
      loanCode: 'LN-0001',
      borrowerId: 'borrower-1',
      loanProductVersionId: 'version-1',
      branchId: 'branch-1',
      principalAmount: '10000.00',
      interestRate: '2.5',
      installmentCount: 12,
    });

    expect(loan.status).toBe('PENDING_APPROVAL');
    expect(loanAccountRepository.save).toHaveBeenCalledWith(loan);
  });
});
