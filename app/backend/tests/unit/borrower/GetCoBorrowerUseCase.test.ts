import { describe, expect, it, vi } from 'vitest';
import { GetCoBorrowerUseCase } from '@modules/borrower/application/use-cases/GetCoBorrowerUseCase';
import { CoBorrower } from '@modules/borrower/domain/CoBorrower';
import { PersonName } from '@modules/borrower/domain/valueObjects/PersonName';
import { NotFoundError } from '@shared/errors/DomainError';

describe('GetCoBorrowerUseCase', () => {
  it('returns the co-borrower when found', async () => {
    const coBorrower = CoBorrower.create({ name: PersonName.of('Maria', 'Santos') });
    const coBorrowerRepository = { findById: vi.fn().mockResolvedValue(coBorrower), save: vi.fn() };
    const useCase = new GetCoBorrowerUseCase({ coBorrowerRepository });

    await expect(useCase.execute(coBorrower.id)).resolves.toBe(coBorrower);
  });

  it('throws NotFoundError when the co-borrower does not exist', async () => {
    const coBorrowerRepository = { findById: vi.fn().mockResolvedValue(null), save: vi.fn() };
    const useCase = new GetCoBorrowerUseCase({ coBorrowerRepository });

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });
});
