import { describe, expect, it, vi } from 'vitest';
import { ListLoanProductsUseCase } from '@modules/loan-product/application/use-cases/ListLoanProductsUseCase';

describe('ListLoanProductsUseCase', () => {
  it('delegates to the repository with the given pagination params', async () => {
    const loanProductRepository = { findById: vi.fn(), findByCode: vi.fn(), findMany: vi.fn().mockResolvedValue([]), save: vi.fn() };
    const useCase = new ListLoanProductsUseCase({ loanProductRepository });

    await useCase.execute({ limit: 10, cursor: 'p-1' });

    expect(loanProductRepository.findMany).toHaveBeenCalledWith({ limit: 10, cursor: 'p-1' });
  });
});
