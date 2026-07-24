import { describe, expect, it, vi } from 'vitest';
import { UpdatePortalProfileUseCase } from '@modules/client-portal/application/use-cases/UpdatePortalProfileUseCase';
import { PortalAccountNotLinkedError } from '@modules/client-portal/domain/errors/PortalAuthErrors';
import { NotFoundError } from '@shared/errors/DomainError';

describe('UpdatePortalProfileUseCase', () => {
  it('throws NotFoundError when the portal account does not exist', async () => {
    const portalAccountRepository = { findById: vi.fn().mockResolvedValue(null) };
    const updateBorrowerUseCase = { execute: vi.fn() };
    const useCase = new UpdatePortalProfileUseCase({ portalAccountRepository, updateBorrowerUseCase } as never);

    await expect(useCase.execute('missing', { email: 'new@example.com' })).rejects.toThrow(NotFoundError);
    expect(updateBorrowerUseCase.execute).not.toHaveBeenCalled();
  });

  it('throws PortalAccountNotLinkedError when the account has no borrowerId yet', async () => {
    const portalAccountRepository = { findById: vi.fn().mockResolvedValue({ id: 'account-1', borrowerId: null }) };
    const updateBorrowerUseCase = { execute: vi.fn() };
    const useCase = new UpdatePortalProfileUseCase({ portalAccountRepository, updateBorrowerUseCase } as never);

    await expect(useCase.execute('account-1', { email: 'new@example.com' })).rejects.toThrow(PortalAccountNotLinkedError);
    expect(updateBorrowerUseCase.execute).not.toHaveBeenCalled();
  });

  it('delegates to UpdateBorrowerUseCase with only the contact-info fields, scoped to the linked borrowerId', async () => {
    const portalAccountRepository = { findById: vi.fn().mockResolvedValue({ id: 'account-1', borrowerId: 'borrower-1' }) };
    const updateBorrowerUseCase = { execute: vi.fn().mockResolvedValue({ id: 'borrower-1' }) };
    const useCase = new UpdatePortalProfileUseCase({ portalAccountRepository, updateBorrowerUseCase } as never);

    await useCase.execute('account-1', { mobilePhone1: '09171234567', email: 'new@example.com' });

    expect(updateBorrowerUseCase.execute).toHaveBeenCalledWith('borrower-1', {
      mobilePhone1: '09171234567',
      mobilePhone2: undefined,
      email: 'new@example.com',
      addresses: undefined,
    });
  });
});
