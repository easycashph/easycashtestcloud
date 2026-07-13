import { describe, expect, it, vi } from 'vitest';
import { GetCurrentUserUseCase } from '@modules/identity/application/use-cases/GetCurrentUserUseCase';
import { UserNotFoundError, UserInactiveError } from '@modules/identity/application/errors/AuthErrors';
import type { IUserRepository, UserRecord } from '@modules/identity/application/ports/IUserRepository';

const activeUser: UserRecord = {
  id: 'user-1',
  branchId: 'branch-1',
  email: 'officer@easycash.ph',
  passwordHash: 'stored-hash',
  firstName: 'Ana',
  lastName: 'Reyes',
  status: 'ACTIVE',
  roles: ['CRM'],
  contactNumber: null,
  address: null,
  birthday: null,
};

function buildDeps(user: UserRecord | null) {
  const userRepository: IUserRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn().mockResolvedValue(user),
    create: vi.fn(),
    hasAnyUserWithRole: vi.fn(),
  };
  return { userRepository };
}

describe('GetCurrentUserUseCase (production-readiness review: gap fill — previously zero coverage)', () => {
  it('returns the live profile for an active user, WITHOUT exposing passwordHash', async () => {
    const deps = buildDeps(activeUser);
    const result = await new GetCurrentUserUseCase(deps).execute({ userId: activeUser.id });

    expect(result).toEqual({
      id: activeUser.id,
      email: activeUser.email,
      firstName: activeUser.firstName,
      lastName: activeUser.lastName,
      branchId: activeUser.branchId,
      roles: activeUser.roles,
      status: 'ACTIVE',
      contactNumber: null,
      address: null,
      birthday: null,
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('throws UserNotFoundError when the user no longer exists', async () => {
    const deps = buildDeps(null);
    await expect(new GetCurrentUserUseCase(deps).execute({ userId: 'gone' })).rejects.toThrow(UserNotFoundError);
  });

  it('throws UserInactiveError when the user has since been deactivated (re-fetches live status, does not trust stale claims)', async () => {
    const deps = buildDeps({ ...activeUser, status: 'SUSPENDED' });
    await expect(new GetCurrentUserUseCase(deps).execute({ userId: activeUser.id })).rejects.toThrow(UserInactiveError);
  });
});
