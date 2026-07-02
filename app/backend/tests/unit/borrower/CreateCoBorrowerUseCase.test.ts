import { describe, expect, it, vi } from 'vitest';
import { CreateCoBorrowerUseCase } from '@modules/borrower/application/use-cases/CreateCoBorrowerUseCase';
import type { ICoBorrowerRepository } from '@modules/borrower/application/ports/ICoBorrowerRepository';

describe('CreateCoBorrowerUseCase', () => {
  it('creates and persists a new CoBorrower', async () => {
    const coBorrowerRepository: ICoBorrowerRepository = { findById: vi.fn(), save: vi.fn() };
    const useCase = new CreateCoBorrowerUseCase({ coBorrowerRepository });

    const coBorrower = await useCase.execute({ firstName: 'Maria', lastName: 'Santos', relationship: 'Spouse' });

    expect(coBorrower.relationship).toBe('Spouse');
    expect(coBorrowerRepository.save).toHaveBeenCalledWith(coBorrower);
  });
});
