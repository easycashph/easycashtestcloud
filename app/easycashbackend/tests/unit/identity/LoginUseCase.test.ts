import { describe, expect, it, vi } from 'vitest';
import { LoginUseCase } from '@modules/identity/application/use-cases/LoginUseCase';
import { InvalidCredentialsError, AccountInactiveError } from '@modules/identity/application/errors/AuthErrors';
import type { IUserRepository, UserRecord } from '@modules/identity/application/ports/IUserRepository';
import type { IPasswordHasher } from '@modules/identity/application/ports/IPasswordHasher';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import type { IRefreshTokenRepository } from '@modules/identity/application/ports/IRefreshTokenRepository';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';

const activeUser: UserRecord = {
  id: 'user-1',
  branchId: 'branch-1',
  email: 'officer@easycash.ph',
  passwordHash: 'stored-hash',
  firstName: 'Ana',
  lastName: 'Reyes',
  status: 'ACTIVE',
  roles: ['CRM'],
  twoFactorEnabled: false,
  twoFactorChannel: null,
};

function buildDeps(overrides: { user?: UserRecord | null; passwordMatches?: boolean } = {}) {
  const userRepository: IUserRepository = {
    findByEmail: vi.fn().mockResolvedValue(overrides.user === undefined ? activeUser : overrides.user),
    findById: vi.fn(),
    create: vi.fn(),
    hasAnyUserWithRole: vi.fn(),
  };
  const passwordHasher: IPasswordHasher = {
    hash: vi.fn(),
    compare: vi.fn().mockResolvedValue(overrides.passwordMatches ?? true),
  };
  const tokenService: ITokenService = {
    signAccessToken: vi.fn().mockReturnValue({ token: 'access-token', expiresAt: new Date() }),
    verifyAccessToken: vi.fn(),
  };
  const refreshTokenRepository: IRefreshTokenRepository = {
    issue: vi.fn().mockResolvedValue({ id: 'rt-1', rawToken: 'raw-refresh-token' }),
    findByRawToken: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
  };
  const auditLogger: IAuditLogger = { log: vi.fn() };
  const twoFactorChallengeRepository = {
    create: vi.fn().mockResolvedValue({ id: 'challenge-1', code: '123456' }),
    findById: vi.fn(),
    verifyAndConsume: vi.fn(),
    incrementAttempts: vi.fn(),
  };
  const otpSender = { send: vi.fn() };
  const trustedDeviceRepository = { issue: vi.fn(), findValidByRawToken: vi.fn() };
  const permissionCodesRepository = { getGrantedPermissionCodes: vi.fn().mockResolvedValue([]) };

  return {
    userRepository,
    passwordHasher,
    tokenService,
    refreshTokenRepository,
    auditLogger,
    twoFactorChallengeRepository,
    otpSender,
    trustedDeviceRepository,
    permissionCodesRepository,
  };
}

describe('LoginUseCase', () => {
  it('succeeds for a valid active user with the correct password', async () => {
    const deps = buildDeps();
    const useCase = new LoginUseCase(deps);

    const result = await useCase.execute({ email: activeUser.email, password: 'correct' });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('raw-refresh-token');
    expect(result.user.id).toBe(activeUser.id);
    expect(deps.auditLogger.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_SUCCESS' }));
  });

  it('throws the SAME InvalidCredentialsError for an unknown email as for a wrong password (enumeration mitigation)', async () => {
    const unknownEmailDeps = buildDeps({ user: null });
    const wrongPasswordDeps = buildDeps({ passwordMatches: false });

    await expect(new LoginUseCase(unknownEmailDeps).execute({ email: 'nobody@x.com', password: 'x' })).rejects.toThrow(
      InvalidCredentialsError,
    );
    await expect(
      new LoginUseCase(wrongPasswordDeps).execute({ email: activeUser.email, password: 'wrong' }),
    ).rejects.toThrow(InvalidCredentialsError);

    // Both paths still invoke bcrypt.compare — timing-attack mitigation (Milestone 6 plan §4).
    expect(unknownEmailDeps.passwordHasher.compare).toHaveBeenCalled();
  });

  it('rejects an inactive account even with the correct password', async () => {
    const deps = buildDeps({ user: { ...activeUser, status: 'SUSPENDED' } });
    await expect(new LoginUseCase(deps).execute({ email: activeUser.email, password: 'correct' })).rejects.toThrow(
      AccountInactiveError,
    );
  });

  it('2026-07-22 (Two-Factor Authentication) - returns a twoFactorRequired challenge instead of tokens for a 2FA-enabled account, and issues no LOGIN_SUCCESS audit entry yet', async () => {
    const deps = buildDeps({ user: { ...activeUser, twoFactorEnabled: true, twoFactorChannel: 'EMAIL' } });

    const result = await new LoginUseCase(deps).execute({ email: activeUser.email, password: 'correct' });

    expect(result).toEqual({ twoFactorRequired: true, challengeId: 'challenge-1', channel: 'EMAIL' });
    expect(deps.twoFactorChallengeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: activeUser.id, purpose: 'LOGIN', channel: 'EMAIL' }),
    );
    expect(deps.otpSender.send).toHaveBeenCalledWith('EMAIL', activeUser.email, '123456');
    expect(deps.refreshTokenRepository.issue).not.toHaveBeenCalled();
    expect(deps.auditLogger.log).not.toHaveBeenCalled();
  });
});
