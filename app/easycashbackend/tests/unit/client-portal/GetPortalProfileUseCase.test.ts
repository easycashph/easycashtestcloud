import { describe, expect, it, vi } from 'vitest';
import { GetPortalProfileUseCase } from '@modules/client-portal/application/use-cases/GetPortalProfileUseCase';
import { PortalAccountNotLinkedError } from '@modules/client-portal/domain/errors/PortalAuthErrors';
import { NotFoundError } from '@shared/errors/DomainError';
import { Borrower } from '@modules/borrower/domain/Borrower';
import { PersonName } from '@modules/borrower/domain/valueObjects/PersonName';

describe('GetPortalProfileUseCase', () => {
  it('throws NotFoundError when the portal account does not exist', async () => {
    const portalAccountRepository = { findById: vi.fn().mockResolvedValue(null) };
    const borrowerRepository = { findById: vi.fn() };
    const useCase = new GetPortalProfileUseCase({ portalAccountRepository, borrowerRepository } as never);

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });

  it('throws PortalAccountNotLinkedError when the account has no borrowerId yet', async () => {
    const portalAccountRepository = { findById: vi.fn().mockResolvedValue({ id: 'account-1', borrowerId: null }) };
    const borrowerRepository = { findById: vi.fn() };
    const useCase = new GetPortalProfileUseCase({ portalAccountRepository, borrowerRepository } as never);

    await expect(useCase.execute('account-1')).rejects.toThrow(PortalAccountNotLinkedError);
    expect(borrowerRepository.findById).not.toHaveBeenCalled();
  });

  it('returns the linked Borrower', async () => {
    const borrower = Borrower.create({ branchId: 'branch-1', name: PersonName.of('Juan', 'Dela Cruz') });
    const portalAccountRepository = { findById: vi.fn().mockResolvedValue({ id: 'account-1', borrowerId: borrower.id }) };
    const borrowerRepository = { findById: vi.fn().mockResolvedValue(borrower) };
    const useCase = new GetPortalProfileUseCase({ portalAccountRepository, borrowerRepository } as never);

    const result = await useCase.execute('account-1');

    expect(result).toBe(borrower);
  });
});
