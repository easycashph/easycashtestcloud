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

function buildDeps(
  record: RefreshTokenRecord | null,
  options: { user?: UserRecord | null; rotateResult?: { id: string; rawToken: string } | null } = {},
) {
  const user = options.user === undefined ? activeUser : options.user;
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
    issue: vi.fn(),
    findByRawToken: vi.fn().mockResolvedValue(record),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
    // Default: "this call won the atomic claim and rotated successfully" —
    // the common case in these unit tests, which exercise the use case's
    // decision logic. The atomicity/rollback guarantee itself is the
    // repository's responsibility — see PrismaRefreshTokenRepository.test.ts.
    rotate: vi.fn().mockResolvedValue(
      options.rotateResult === undefined ? { id: 'rt-2', rawToken: 'new-raw-refresh-token' } : options.rotateResult,
    ),
  };
  return { userRepository, tokenService, refreshTokenRepository };
}

describe('RefreshTokenUseCase', () => {
  it('rotates a valid, unexpired, unrevoked token', async () => {
    const deps = buildDeps({ id: 'rt-1', userId: activeUser.id, expiresAt: new Date(Date.now() + 60_000), revokedAt: null });
    const result = await new RefreshTokenUseCase(deps).execute({ rawRefreshToken: 'raw' });

    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBe('new-raw-refresh-token');
    expect(deps.refreshTokenRepository.rotate).toHaveBeenCalledWith(
      'rt-1',
      expect.objectContaining({ userId: activeUser.id }),
    );
  });

  it('throws TokenNotFoundError when no matching token exists', async () => {
    const deps = buildDeps(null);
    await expect(new RefreshTokenUseCase(deps).execute({ rawRefreshToken: 'raw' })).rejects.toThrow(TokenNotFoundError);
    expect(deps.refreshTokenRepository.rotate).not.toHaveBeenCalled();
  });

  it('throws TokenExpiredError for an expired-but-not-revoked token WITHOUT attempting to rotate it', async () => {
    const deps = buildDeps({ id: 'rt-1', userId: activeUser.id, expiresAt: new Date(Date.now() - 1000), revokedAt: null });
    await expect(new RefreshTokenUseCase(deps).execute({ rawRefreshToken: 'raw' })).rejects.toThrow(TokenExpiredError);
    // Production-readiness revision: expiry is checked before any DB write
    // is attempted — an expired token is simply rejected, not revoked.
    expect(deps.refreshTokenRepository.rotate).not.toHaveBeenCalled();
  });

  it('rejects a valid token whose user is no longer active WITHOUT attempting to rotate it', async () => {
    const deps = buildDeps(
      { id: 'rt-1', userId: activeUser.id, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
      { user: { ...activeUser, status: 'INACTIVE' } },
    );
    await expect(new RefreshTokenUseCase(deps).execute({ rawRefreshToken: 'raw' })).rejects.toThrow(UserInactiveError);
    expect(deps.refreshTokenRepository.rotate).not.toHaveBeenCalled();
  });

  it('detects reuse of an already-revoked token (fast path) and revokes the whole session family', async () => {
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
    expect(deps.refreshTokenRepository.rotate).not.toHaveBeenCalled();
  });

  it('C-01: detects a concurrent-reuse race — rotate() returns null because another request won the atomic claim', async () => {
    // Simulates two concurrent requests presenting the same valid token:
    // both pass the expiry/user-status checks (neither writes to the DB),
    // but only one wins IRefreshTokenRepository.rotate()'s atomic claim.
    // This test represents the LOSING request.
    const deps = buildDeps(
      { id: 'rt-1', userId: activeUser.id, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
      { rotateResult: null },
    );

    await expect(new RefreshTokenUseCase(deps).execute({ rawRefreshToken: 'raw' })).rejects.toThrow(
      TokenReuseDetectedError,
    );
    expect(deps.refreshTokenRepository.rotate).toHaveBeenCalledWith('rt-1', expect.anything());
    expect(deps.refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith(activeUser.id);
  });
});
