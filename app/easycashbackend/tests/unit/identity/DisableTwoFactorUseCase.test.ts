import { describe, expect, it, vi } from 'vitest';
import { DisableTwoFactorUseCase } from '@modules/identity/application/use-cases/DisableTwoFactorUseCase';
import { InvalidCredentialsError } from '@modules/identity/application/errors/AuthErrors';

function buildDeps(overrides: { passwordMatches?: boolean } = {}) {
  const userRepository = {
    findById: vi.fn().mockResolvedValue({ id: 'user-1', passwordHash: 'stored-hash' }),
    update: vi.fn(),
  };
  const passwordHasher = { compare: vi.fn().mockResolvedValue(overrides.passwordMatches ?? true) };
  return { userRepository, passwordHasher } as never;
}

describe('DisableTwoFactorUseCase', () => {
  it('turns 2FA off when the current password is correct', async () => {
    const deps = buildDeps();
    await new DisableTwoFactorUseCase(deps).execute({ userId: 'user-1', currentPassword: 'correct' });
    expect(deps.userRepository.update).toHaveBeenCalledWith('user-1', { twoFactorEnabled: false, twoFactorChannel: null });
  });

  it('throws InvalidCredentialsError and makes no change when the password is wrong', async () => {
    const deps = buildDeps({ passwordMatches: false });
    await expect(new DisableTwoFactorUseCase(deps).execute({ userId: 'user-1', currentPassword: 'wrong' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    expect(deps.userRepository.update).not.toHaveBeenCalled();
  });
});
