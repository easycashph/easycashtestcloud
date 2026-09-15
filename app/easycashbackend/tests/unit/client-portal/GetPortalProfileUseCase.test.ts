import { describe, expect, it, vi } from 'vitest';
import { GetPortalProfileUseCase } from '@modules/client-portal/application/use-cases/GetPortalProfileUseCase';
import { NotFoundError } from '@shared/errors/DomainError';
import { Borrower } from '@modules/borrower/domain/Borrower';
import { PersonName } from '@modules/borrower/domain/valueObjects/PersonName';

describe('GetPortalProfileUseCase', () => {
  it('throws NotFoundError when the portal account does not exist', async () => {
    const portalAccountRepository = { findById: vi.fn().mockResolvedValue(null) };
    const borrowerRepository = { findById: vi.fn() };
    const attachmentRepository = { listByOwner: vi.fn().mockResolvedValue([]) };
    const useCase = new GetPortalProfileUseCase({ portalAccountRepository, borrowerRepository, attachmentRepository } as never);

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });

  // 2026-07-30 (user request): an unlinked account no longer throws - it gets its own
  // pre-application profile view/edit surface instead (see GetPortalProfileUseCase's own doc
  // comment, `fromPortalAccount`).
  it('returns a pre-application profile when the account has no borrowerId yet', async () => {
    const portalAccountRepository = {
      findById: vi.fn().mockResolvedValue({ id: 'account-1', borrowerId: null, firstName: 'Juan', lastName: 'Dela Cruz', dependants: [] }),
    };
    const borrowerRepository = { findById: vi.fn() };
    const attachmentRepository = { listByOwner: vi.fn().mockResolvedValue([]) };
    const useCase = new GetPortalProfileUseCase({ portalAccountRepository, borrowerRepository, attachmentRepository } as never);

    const result = await useCase.execute('account-1');

    expect(result.id).toBe('account-1');
    expect(result.firstName).toBe('Juan');
    expect(borrowerRepository.findById).not.toHaveBeenCalled();
  });

  it('returns the linked Borrower as a profile DTO', async () => {
    const borrower = Borrower.create({ branchId: 'branch-1', name: PersonName.of('Juan', 'Dela Cruz') });
    const portalAccountRepository = { findById: vi.fn().mockResolvedValue({ id: 'account-1', borrowerId: borrower.id }) };
    const borrowerRepository = { findById: vi.fn().mockResolvedValue(borrower) };
    const attachmentRepository = { listByOwner: vi.fn().mockResolvedValue([]) };
    const useCase = new GetPortalProfileUseCase({ portalAccountRepository, borrowerRepository, attachmentRepository } as never);

    const result = await useCase.execute('account-1');

    expect(result.id).toBe(borrower.id);
    expect(result.firstName).toBe('Juan');
    expect(result.lastName).toBe('Dela Cruz');
  });

  // 2026-09-14 (user request: "make profile picture mandatory") - hasProfilePhoto is keyed by the
  // PortalAccount's own id, not the Borrower's, so it's checked regardless of linkage.
  it('reports hasProfilePhoto true when a PORTAL_ACCOUNT-owned photo attachment exists', async () => {
    const portalAccountRepository = {
      findById: vi.fn().mockResolvedValue({ id: 'account-1', borrowerId: null, firstName: 'Juan', lastName: 'Dela Cruz', dependants: [] }),
    };
    const borrowerRepository = { findById: vi.fn() };
    const attachmentRepository = {
      listByOwner: vi.fn().mockResolvedValue([{ documentCategory: 'PROFILE_PICTURE', uploadedAt: new Date() }]),
    };
    const useCase = new GetPortalProfileUseCase({ portalAccountRepository, borrowerRepository, attachmentRepository } as never);

    const result = await useCase.execute('account-1');

    expect(result.hasProfilePhoto).toBe(true);
    expect(attachmentRepository.listByOwner).toHaveBeenCalledWith('PORTAL_ACCOUNT', 'account-1');
  });
});
