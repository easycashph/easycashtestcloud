import { describe, expect, it, vi } from 'vitest';
import { CreateBorrowerUseCase } from '@modules/borrower/application/use-cases/CreateBorrowerUseCase';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import { Borrower } from '@modules/borrower/domain/Borrower';
import { PersonName } from '@modules/borrower/domain/valueObjects/PersonName';
import { DuplicateClientProfileError, InvalidPersonNameError } from '@modules/borrower/domain/errors/BorrowerDomainErrors';

function buildRepo(): IBorrowerRepository {
  return { findById: vi.fn(), save: vi.fn(), findBySourceApplicationId: vi.fn().mockResolvedValue(null) } as unknown as IBorrowerRepository;
}

describe('CreateBorrowerUseCase', () => {
  it('creates and persists a new ACTIVE Borrower', async () => {
    const borrowerRepository = buildRepo();
    const useCase = new CreateBorrowerUseCase({ borrowerRepository });

    const borrower = await useCase.execute({ branchId: 'branch-1', firstName: 'Juan', lastName: 'Dela Cruz' });

    expect(borrower.status).toBe('ACTIVE');
    expect(borrowerRepository.save).toHaveBeenCalledWith(borrower);
  });

  // 2026-07-16 (Create Client Account, per the legacy Excel LMS's Client_details sheet).
  it('carries suffix, facebookLink, and monthsEmployed through to the created Borrower', async () => {
    const borrowerRepository = buildRepo();
    const useCase = new CreateBorrowerUseCase({ borrowerRepository });

    const borrower = await useCase.execute({
      branchId: 'branch-1',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      suffix: 'Jr.',
      facebookLink: 'facebook.com/juandelacruz',
      incomeDetail: { yearsEmployed: 3, monthsEmployed: 7 },
    });

    expect(borrower.suffix).toBe('Jr.');
    expect(borrower.facebookLink).toBe('facebook.com/juandelacruz');
    expect(borrower.incomeDetail?.monthsEmployed).toBe(7);
  });

  it('propagates InvalidPersonNameError without saving anything for a blank name', async () => {
    const borrowerRepository = buildRepo();
    const useCase = new CreateBorrowerUseCase({ borrowerRepository });

    await expect(useCase.execute({ branchId: 'branch-1', firstName: '', lastName: 'Dela Cruz' })).rejects.toThrow(
      InvalidPersonNameError,
    );
    expect(borrowerRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a second Client Profile for an already-converted LoanApplication', async () => {
    const borrowerRepository = buildRepo();
    const alreadyConverted = Borrower.create({ branchId: 'branch-1', name: PersonName.of('Juan', 'Dela Cruz'), sourceApplicationId: 'app-1' });
    (borrowerRepository.findBySourceApplicationId as ReturnType<typeof vi.fn>).mockResolvedValue(alreadyConverted);
    const useCase = new CreateBorrowerUseCase({ borrowerRepository });

    await expect(
      useCase.execute({ branchId: 'branch-1', firstName: 'Juan', lastName: 'Dela Cruz', sourceApplicationId: 'app-1' }),
    ).rejects.toThrow(DuplicateClientProfileError);
    expect(borrowerRepository.save).not.toHaveBeenCalled();
  });
});
