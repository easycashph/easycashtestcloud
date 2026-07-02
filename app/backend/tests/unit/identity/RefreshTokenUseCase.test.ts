import { describe, expect, it, vi } from 'vitest';
import { RefreshTokenUseCase } from '@modules/identity/application/use-cases/RefreshTokenUseCase';
import {
  TokenNotFoundError,
  TokenExpiredError,
  TokenReuseDetectedError,
  UserInactiveError,
} from '@modules/identity/application/errors/AuthErrors';
import type { IUserRepository, UserRecord } from '@modules/identity/application/ports/IUserRepository';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import type { IRefreshTokenRepository, RefreshTokenRecord } from '@modules/identity/application/ports/IRefreshTokenRepository';

const activeUser: UserRecord = {
  id: 'user-1',
  branchId: 'branch-1',
  email: 'officer@easycash.ph',
  passwordHash: 'stored-hash',
  firstName: 'Ana',
  lastName: 'Reyes',
  status: 'ACTIVE',
  roles: ['Loan Officer'],
};

function buildDeps(record: RefreshTokenRecord | null, user: UserRecord | null = activeUser) {
  const userRepository: IUserRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn().mockResolvedValue(user),
    create: vi.fn(),
    hasAnyUserWithRole: vi.fn(),
  };
  const tokenService: ITokenService = {
    signAccessToken: vi.fn().mockReturnValue({ token: 'new-access-token', expiresAt: new Date() }),
    verifyAccessToken: vi.fn(),
  };
  const refreshTokenRepository: IRefreshTokenRepository = {
    issue: vi.fn().mockResolvedValue({ id: 'rt-2', rawToken: 'new-raw-refresh-token' }),
    findByRawToken: vi.fn().mockResolvedValue(record),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
  };
  return { userRepository, tokenService, refreshTokenRepository };
}

describe('RefreshTokenUseCase', () => {
  it('rotates a valid, unexpired, unrevoked token', async () => {
    const deps = buildDeps({ id: 'rt-1', userId: activeUser.id, expiresAt: new Date(Date.now() + 60_000), revokedAt: null });
    const result = await new RefreshTokenUseCase(deps).execute({ rawRefreshToken: 'raw' });

    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBe('new-raw-refresh-token');
    expect(deps.refreshTokenRepository.revoke).toHaveBeenCalledWith('rt-1');
  });

  it('throws TokenNotFoundError when no matching token exists', async () => {
    const deps = buildDeps(null);
    await expect(new RefreshTokenUseCase(deps).execute({ rawRefreshToken: 'raw' })).rejects.toThrow(TokenNotFoundError);
  });

  it('throws TokenExpiredError for an expired-but-not-revoked token', async () => {
    const deps = buildDeps({ id: 'rt-1', userId: activeUser.id, expiresAt: new Date(Date.now() - 1000), revokedAt: null });
    await expect(new RefreshTokenUseCase(deps).execute({ rawRefreshToken: 'raw' })).rejects.toThrow(TokenExpiredError);
  });

  it('detects reuse of an already-revoked token and revokes the whole session family', async () => {
    const deps = buildDeps({
      id: 'rt-1',
      userId: activeUser.id,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
    });

    await expect(new RefreshTokenUseCase(deps).execute({ rawRefreshToken: 'raw' })).rejects.toThrow(
      TokenReuseDetectedError,
    );
    expect(deps.refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith(activeUser.id);
  });

  it('rejects a valid token whose user is no longer active', async () => {
    const deps = buildDeps(
      { id: 'rt-1', userId: activeUser.id, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
      { ...activeUser, status: 'INACTIVE' },
    );
    await expect(new RefreshTokenUseCase(deps).execute({ rawRefreshToken: 'raw' })).rejects.toThrow(UserInactiveError);
  });
});
