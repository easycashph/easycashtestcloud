import { describe, expect, it, vi } from 'vitest';
import { RequestTwoFactorSetupUseCase } from '@modules/identity/application/use-cases/RequestTwoFactorSetupUseCase';
import { TwoFactorChannelUnavailableError, UserNotFoundError } from '@modules/identity/application/errors/AuthErrors';
import type { UserRecord } from '@modules/identity/application/ports/IUserRepository';

const user: UserRecord = {
  id: 'user-1',
  branchId: 'branch-1',
  email: 'officer@easycash.ph',
  passwordHash: 'stored-hash',
  firstName: 'Ana',
  lastName: 'Reyes',
  status: 'ACTIVE',
  roles: ['CRM'],
  contactNumber: null,
  twoFactorEnabled: false,
  twoFactorChannel: null,
};

function buildDeps(overrides: { user?: UserRecord | null } = {}) {
  const userRepository = { findById: vi.fn().mockResolvedValue(overrides.user === undefined ? user : overrides.user) };
  const twoFactorChallengeRepository = { create: vi.fn().mockResolvedValue({ id: 'challenge-1', code: '654321' }) };
  const otpSender = { send: vi.fn() };
  return { userRepository, twoFactorChallengeRepository, otpSender } as never;
}

describe('RequestTwoFactorSetupUseCase', () => {
  it('sends a code via email and returns the challenge id, without enabling 2FA yet', async () => {
    const deps = buildDeps();
    const result = await new RequestTwoFactorSetupUseCase(deps).execute({ userId: 'user-1', channel: 'EMAIL' });

    expect(result).toEqual({ challengeId: 'challenge-1' });
    expect(deps.otpSender.send).toHaveBeenCalledWith('EMAIL', 'officer@easycash.ph', '654321');
  });

  it('throws TwoFactorChannelUnavailableError for SMS when the account has no contact number on file', async () => {
    const deps = buildDeps({ user: { ...user, contactNumber: null } });
    await expect(new RequestTwoFactorSetupUseCase(deps).execute({ userId: 'user-1', channel: 'SMS' })).rejects.toBeInstanceOf(
      TwoFactorChannelUnavailableError,
    );
    expect(deps.otpSender.send).not.toHaveBeenCalled();
  });

  it('sends via SMS to the contact number on file when present', async () => {
    const deps = buildDeps({ user: { ...user, contactNumber: '09171234567' } });
    await new RequestTwoFactorSetupUseCase(deps).execute({ userId: 'user-1', channel: 'SMS' });
    expect(deps.otpSender.send).toHaveBeenCalledWith('SMS', '09171234567', '654321');
  });

  it('throws UserNotFoundError for a nonexistent user', async () => {
    const deps = buildDeps({ user: null });
    await expect(new RequestTwoFactorSetupUseCase(deps).execute({ userId: 'ghost', channel: 'EMAIL' })).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });
});
