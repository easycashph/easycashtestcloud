import { describe, expect, it, vi } from 'vitest';
import { ListLoanAccountsUseCase } from '@modules/loan-account/application/use-cases/ListLoanAccountsUseCase';

describe('ListLoanAccountsUseCase', () => {
  it('delegates to the repository with the given pagination params', async () => {
    const loanAccountRepository = { findById: vi.fn(), findByLoanCode: vi.fn(), findMany: vi.fn().mockResolvedValue([]), save: vi.fn() };
    const useCase = new ListLoanAccountsUseCase({ loanAccountRepository });

    await useCase.execute({ limit: 15, cursor: 'la-1' });

    expect(loanAccountRepository.findMany).toHaveBeenCalledWith({ limit: 15, cursor: 'la-1' });
  });

  // Milestone 8.1 remediation (audit finding H-1).
  it('forwards an optional branchId filter through to the repository', async () => {
    const loanAccountRepository = { findById: vi.fn(), findByLoanCode: vi.fn(), findMany: vi.fn().mockResolvedValue([]), save: vi.fn() };
    const useCase = new ListLoanAccountsUseCase({ loanAccountRepository });

    await useCase.execute({ limit: 15, branchId: 'branch-1' });

    expect(loanAccountRepository.findMany).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'branch-1' }));
  });
});
