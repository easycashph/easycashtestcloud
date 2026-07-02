import { describe, expect, it, vi } from 'vitest';
import { GetBorrowerUseCase } from '@modules/borrower/application/use-cases/GetBorrowerUseCase';
import { NotFoundError } from '@shared/errors/DomainError';
import { Borrower } from '@modules/borrower/domain/Borrower';
import { PersonName } from '@modules/borrower/domain/valueObjects/PersonName';

describe('GetBorrowerUseCase', () => {
  it('returns the borrower when found', async () => {
    const borrower = Borrower.create({ branchId: 'branch-1', name: PersonName.of('Juan', 'Dela Cruz') });
    const borrowerRepository = { findById: vi.fn().mockResolvedValue(borrower), save: vi.fn() };
    const useCase = new GetBorrowerUseCase({ borrowerRepository });

    await expect(useCase.execute(borrower.id)).resolves.toBe(borrower);
  });

  it('throws NotFoundError when the borrower does not exist', async () => {
    const borrowerRepository = { findById: vi.fn().mockResolvedValue(null), save: vi.fn() };
    const useCase = new GetBorrowerUseCase({ borrowerRepository });

    await expect(useCase.execute('missing-id')).rejects.toThrow(NotFoundError);
  });
});
