import { describe, expect, it, vi } from 'vitest';
import { ResetPortalAccountPasswordUseCase } from '@modules/client-portal/application/use-cases/ResetPortalAccountPasswordUseCase';
import { BorrowerPortalAccountNotLinkedError } from '@modules/borrower/domain/errors/BorrowerDomainErrors';
import { PortalAccountDeletedError } from '@modules/client-portal/domain/errors/PortalAuthErrors';
import { NotFoundError } from '@shared/errors/DomainError';
import type { PortalAccountRecord } from '@modules/client-portal/application/ports/IPortalAccountRepository';

function buildAccount(overrides: Partial<PortalAccountRecord> = {}): PortalAccountRecord {
  return {
    id: 'account-1',
    email: 'client@example.com',
    passwordHash: 'old-hash',
    contactNumber: null,
    status: 'ACTIVE',
    emailVerifiedAt: new Date(),
    borrowerId: 'borrower-1',
    twoFactorEnabled: false,
    twoFactorChannel: null,
    mustChangePassword: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    firstName: null,
    middleName: null,
    lastName: null,
    suffix: null,
    gender: null,
    birthDate: null,
    placeOfBirth: null,
    nationality: null,
    civilStatus: null,
    homeOwnership: null,
    mobilePhone1: null,
    mobilePhone2: null,
    occupation: null,
    employer: null,
    monthlyIncome: null,
    officeAddress: null,
    tinNumber: null,
    sssNumber: null,
    dependants: null,
    reference1Name: null,
    reference1Mobile: null,
    reference2Name: null,
    reference2Mobile: null,
    houseUnitNumber: null,
    street: null,
    barangay: null,
    cityMunicipality: null,
    province: null,
    zipCode: null,
    ...overrides,
  };
}

function buildDeps(account: PortalAccountRecord | null, borrower: { id: string } | null = { id: 'borrower-1' }) {
  const updated = { ...(account ?? buildAccount()) } as PortalAccountRecord;
  const borrowerRepository = { findById: vi.fn().mockResolvedValue(borrower) };
  const portalAccountRepository = {
    findByBorrowerId: vi.fn().mockResolvedValue(account),
    update: vi.fn().mockImplementation((_id: string, patch: Partial<PortalAccountRecord>) => {
      Object.assign(updated, patch);
      return Promise.resolve(updated);
    }),
  };
  const passwordHasher = { hash: vi.fn().mockResolvedValue('new-hash'), compare: vi.fn() };
  return { borrowerRepository, portalAccountRepository, passwordHasher } as never;
}

describe('ResetPortalAccountPasswordUseCase', () => {
  it('generates a fresh random temporary password and forces a password change', async () => {
    const account = buildAccount({ status: 'ACTIVE', mustChangePassword: false });
    const deps = buildDeps(account);
    const useCase = new ResetPortalAccountPasswordUseCase(deps);

    const result = await useCase.execute('borrower-1', 'staff-1');

    expect(result.email).toBe('client@example.com');
    expect(result.temporaryPassword).toHaveLength(16); // 12 random bytes, base64url-encoded
    expect(deps.portalAccountRepository.update).toHaveBeenCalledWith(
      'account-1',
      expect.objectContaining({ passwordHash: 'new-hash', mustChangePassword: true }),
    );
  });

  it('never reuses the same password across two resets', async () => {
    const deps1 = buildDeps(buildAccount());
    const deps2 = buildDeps(buildAccount());
    const [result1, result2] = await Promise.all([
      new ResetPortalAccountPasswordUseCase(deps1).execute('borrower-1', 'staff-1'),
      new ResetPortalAccountPasswordUseCase(deps2).execute('borrower-1', 'staff-1'),
    ]);
    expect(result1.temporaryPassword).not.toBe(result2.temporaryPassword);
  });

  it('activates a PENDING_VERIFICATION account and marks its email verified', async () => {
    const account = buildAccount({ status: 'PENDING_VERIFICATION', emailVerifiedAt: null });
    const deps = buildDeps(account);

    await new ResetPortalAccountPasswordUseCase(deps).execute('borrower-1', 'staff-1');

    expect(deps.portalAccountRepository.update).toHaveBeenCalledWith(
      'account-1',
      expect.objectContaining({ status: 'ACTIVE', emailVerifiedAt: expect.any(Date) }),
    );
  });

  it('leaves an already-ACTIVE account status untouched', async () => {
    const account = buildAccount({ status: 'ACTIVE' });
    const deps = buildDeps(account);

    await new ResetPortalAccountPasswordUseCase(deps).execute('borrower-1', 'staff-1');

    const patch = deps.portalAccountRepository.update.mock.calls[0][1];
    expect(patch.status).toBeUndefined();
  });

  it('throws NotFoundError when the borrower does not exist', async () => {
    const deps = buildDeps(buildAccount(), null);
    await expect(new ResetPortalAccountPasswordUseCase(deps).execute('missing-borrower', 'staff-1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws BorrowerPortalAccountNotLinkedError when the borrower has no Portal account', async () => {
    const deps = buildDeps(null);
    await expect(new ResetPortalAccountPasswordUseCase(deps).execute('borrower-1', 'staff-1')).rejects.toBeInstanceOf(
      BorrowerPortalAccountNotLinkedError,
    );
  });

  it('throws PortalAccountDeletedError for a DELETED account instead of reviving it', async () => {
    const deps = buildDeps(buildAccount({ status: 'DELETED' }));
    await expect(new ResetPortalAccountPasswordUseCase(deps).execute('borrower-1', 'staff-1')).rejects.toBeInstanceOf(PortalAccountDeletedError);
    expect(deps.portalAccountRepository.update).not.toHaveBeenCalled();
  });
});
