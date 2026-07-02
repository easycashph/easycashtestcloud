import { describe, expect, it, vi } from 'vitest';
import { ListBorrowersUseCase } from '@modules/borrower/application/use-cases/ListBorrowersUseCase';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';

describe('ListBorrowersUseCase', () => {
  it('delegates to the repository with the given pagination params', async () => {
    const borrowerRepository: IBorrowerRepository = { findById: vi.fn(), findMany: vi.fn().mockResolvedValue([]), save: vi.fn() };
    const useCase = new ListBorrowersUseCase({ borrowerRepository });

    await useCase.execute({ limit: 20, cursor: 'b-1' });

    expect(borrowerRepository.findMany).toHaveBeenCalledWith({ limit: 20, cursor: 'b-1' });
  });
});
