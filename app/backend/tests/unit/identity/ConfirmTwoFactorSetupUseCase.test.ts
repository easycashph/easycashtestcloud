import { describe, expect, it, vi } from 'vitest';
import { ConfirmTwoFactorSetupUseCase } from '@modules/identity/application/use-cases/ConfirmTwoFactorSetupUseCase';
import { InvalidOtpError, TooManyOtpAttemptsError } from '@modules/identity/application/errors/AuthErrors';
import type { TwoFactorChallengeRecord } from '@modules/identity/application/ports/ITwoFactorChallengeRepository';

const validChallenge: TwoFactorChallengeRecord = {
  id: 'challenge-1',
  userId: 'user-1',
  purpose: 'ENABLE',
  channel: 'EMAIL',
  expiresAt: new Date(Date.now() + 60_000),
  attempts: 0,
  consumedAt: null,
};

function buildDeps(overrides: { challenge?: TwoFactorChallengeRecord | null; consumed?: boolean } = {}) {
  const userRepository = {
    findById: vi.fn().mockResolvedValue({ id: 'user-1' }),
    update: vi.fn(),
  };
  const twoFactorChallengeRepository = {
    findById: vi.fn().mockResolvedValue(overrides.challenge === undefined ? validChallenge : overrides.challenge),
    verifyAndConsume: vi.fn().mockResolvedValue(overrides.consumed ?? true),
    incrementAttempts: vi.fn(),
  };
  return { userRepository, twoFactorChallengeRepository } as never;
}

describe('ConfirmTwoFactorSetupUseCase', () => {
  it('enables 2FA with the challenge channel when the code is correct', async () => {
    const deps = buildDeps();
    await new ConfirmTwoFactorSetupUseCase(deps).execute({ userId: 'user-1', challengeId: 'challenge-1', code: '111111' });
    expect(deps.userRepository.update).toHaveBeenCalledWith('user-1', { twoFactorEnabled: true, twoFactorChannel: 'EMAIL' });
  });

  it('throws InvalidOtpError and does not enable 2FA when the code is wrong', async () => {
    const deps = buildDeps({ consumed: false });
    await expect(
      new ConfirmTwoFactorSetupUseCase(deps).execute({ userId: 'user-1', challengeId: 'challenge-1', code: 'wrong' }),
    ).rejects.toBeInstanceOf(InvalidOtpError);
    expect(deps.twoFactorChallengeRepository.incrementAttempts).toHaveBeenCalledWith('challenge-1');
    expect(deps.userRepository.update).not.toHaveBeenCalled();
  });

  it('throws InvalidOtpError, never leaking existence, when the challenge belongs to a different user', async () => {
    const deps = buildDeps({ challenge: { ...validChallenge, userId: 'someone-else' } });
    await expect(
      new ConfirmTwoFactorSetupUseCase(deps).execute({ userId: 'user-1', challengeId: 'challenge-1', code: '111111' }),
    ).rejects.toBeInstanceOf(InvalidOtpError);
  });

  it('throws InvalidOtpError for a LOGIN-purpose challenge (wrong purpose)', async () => {
    const deps = buildDeps({ challenge: { ...validChallenge, purpose: 'LOGIN' } });
    await expect(
      new ConfirmTwoFactorSetupUseCase(deps).execute({ userId: 'user-1', challengeId: 'challenge-1', code: '111111' }),
    ).rejects.toBeInstanceOf(InvalidOtpError);
  });

  it('throws TooManyOtpAttemptsError once attempts reach the max', async () => {
    const deps = buildDeps({ challenge: { ...validChallenge, attempts: 5 } });
    await expect(
      new ConfirmTwoFactorSetupUseCase(deps).execute({ userId: 'user-1', challengeId: 'challenge-1', code: '111111' }),
    ).rejects.toBeInstanceOf(TooManyOtpAttemptsError);
  });
});
