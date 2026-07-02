import { describe, expect, it, vi } from 'vitest';
import { ListLoanAccountsUseCase } from '@modules/loan-account/application/use-cases/ListLoanAccountsUseCase';

describe('ListLoanAccountsUseCase', () => {
  it('delegates to the repository with the given pagination params', async () => {
    const loanAccountRepository = { findById: vi.fn(), findByLoanCode: vi.fn(), findMany: vi.fn().mockResolvedValue([]), save: vi.fn() };
    const useCase = new ListLoanAccountsUseCase({ loanAccountRepository });

    await useCase.execute({ limit: 15, cursor: 'la-1' });

    expect(loanAccountRepository.findMany).toHaveBeenCalledWith({ limit: 15, cursor: 'la-1' });
  });
});
