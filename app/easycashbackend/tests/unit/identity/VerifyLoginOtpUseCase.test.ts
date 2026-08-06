import { describe, expect, it, vi } from 'vitest';
import { VerifyLoginOtpUseCase } from '@modules/identity/application/use-cases/VerifyLoginOtpUseCase';
import { InvalidOtpError, TooManyOtpAttemptsError } from '@modules/identity/application/errors/AuthErrors';
import type { TwoFactorChallengeRecord } from '@modules/identity/application/ports/ITwoFactorChallengeRepository';
import type { UserRecord } from '@modules/identity/application/ports/IUserRepository';

const validChallenge: TwoFactorChallengeRecord = {
  id: 'challenge-1',
  userId: 'user-1',
  purpose: 'LOGIN',
  channel: 'EMAIL',
  expiresAt: new Date(Date.now() + 60_000),
  attempts: 0,
  consumedAt: null,
};

const user: UserRecord = {
  id: 'user-1',
  branchId: 'branch-1',
  email: 'officer@easycash.ph',
  passwordHash: 'stored-hash',
  firstName: 'Ana',
  lastName: 'Reyes',
  status: 'ACTIVE',
  roles: ['CRM'],
  twoFactorEnabled: true,
  twoFactorChannel: 'EMAIL',
};

function buildDeps(overrides: { challenge?: TwoFactorChallengeRecord | null; consumed?: boolean; user?: UserRecord | null } = {}) {
  const userRepository = { findById: vi.fn().mockResolvedValue(overrides.user === undefined ? user : overrides.user) };
  const tokenService = { signAccessToken: vi.fn().mockReturnValue({ token: 'access-token', expiresAt: new Date() }) };
  const refreshTokenRepository = { issue: vi.fn().mockResolvedValue({ id: 'rt-1', rawToken: 'raw-refresh-token' }) };
  const auditLogger = { log: vi.fn() };
  const twoFactorChallengeRepository = {
    findById: vi.fn().mockResolvedValue(overrides.challenge === undefined ? validChallenge : overrides.challenge),
    verifyAndConsume: vi.fn().mockResolvedValue(overrides.consumed ?? true),
    incrementAttempts: vi.fn(),
  };
  const permissionCodesRepository = { getGrantedPermissionCodes: vi.fn().mockResolvedValue([]) };
  return { userRepository, tokenService, refreshTokenRepository, auditLogger, twoFactorChallengeRepository, permissionCodesRepository } as never;
}

describe('VerifyLoginOtpUseCase', () => {
  it('issues tokens and logs LOGIN_SUCCESS when the code is correct', async () => {
    const deps = buildDeps();
    const result = await new VerifyLoginOtpUseCase(deps).execute({ challengeId: 'challenge-1', code: '111111' });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('raw-refresh-token');
    expect(result.user.id).toBe('user-1');
    expect(deps.auditLogger.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_SUCCESS' }));
  });

  it('throws InvalidOtpError and logs LOGIN_FAILED, without issuing tokens, when the code is wrong', async () => {
    const deps = buildDeps({ consumed: false });
    await expect(new VerifyLoginOtpUseCase(deps).execute({ challengeId: 'challenge-1', code: 'wrong' })).rejects.toBeInstanceOf(
      InvalidOtpError,
    );
    expect(deps.refreshTokenRepository.issue).not.toHaveBeenCalled();
    expect(deps.auditLogger.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_FAILED' }));
  });

  it('throws InvalidOtpError for an already-expired challenge', async () => {
    const deps = buildDeps({ challenge: { ...validChallenge, expiresAt: new Date(Date.now() - 1000) } });
    await expect(new VerifyLoginOtpUseCase(deps).execute({ challengeId: 'challenge-1', code: '111111' })).rejects.toBeInstanceOf(
      InvalidOtpError,
    );
  });

  it('throws TooManyOtpAttemptsError once attempts reach the max', async () => {
    const deps = buildDeps({ challenge: { ...validChallenge, attempts: 5 } });
    await expect(new VerifyLoginOtpUseCase(deps).execute({ challengeId: 'challenge-1', code: '111111' })).rejects.toBeInstanceOf(
      TooManyOtpAttemptsError,
    );
  });
});
