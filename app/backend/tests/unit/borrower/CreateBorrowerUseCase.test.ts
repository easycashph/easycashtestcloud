import { describe, expect, it, vi } from 'vitest';
import { CreateBorrowerUseCase } from '@modules/borrower/application/use-cases/CreateBorrowerUseCase';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import { InvalidPersonNameError } from '@modules/borrower/domain/errors/BorrowerDomainErrors';

function buildRepo(): IBorrowerRepository {
  return { findById: vi.fn(), save: vi.fn() };
}

describe('CreateBorrowerUseCase', () => {
  it('creates and persists a new ACTIVE Borrower', async () => {
    const borrowerRepository = buildRepo();
    const useCase = new CreateBorrowerUseCase({ borrowerRepository });

    const borrower = await useCase.execute({ branchId: 'branch-1', firstName: 'Juan', lastName: 'Dela Cruz' });

    expect(borrower.status).toBe('ACTIVE');
    expect(borrowerRepository.save).toHaveBeenCalledWith(borrower);
  });

  it('propagates InvalidPersonNameError without saving anything for a blank name', async () => {
    const borrowerRepository = buildRepo();
    const useCase = new CreateBorrowerUseCase({ borrowerRepository });

    await expect(useCase.execute({ branchId: 'branch-1', firstName: '', lastName: 'Dela Cruz' })).rejects.toThrow(
      InvalidPersonNameError,
    );
    expect(borrowerRepository.save).not.toHaveBeenCalled();
  });
});
