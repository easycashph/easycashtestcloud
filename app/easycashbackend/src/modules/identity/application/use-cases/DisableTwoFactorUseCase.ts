import type { IUserRepository } from '../ports/IUserRepository';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import type { DisableTwoFactorInput } from '../dtos/AuthDtos';
import { InvalidCredentialsError, UserNotFoundError } from '../errors/AuthErrors';

export interface DisableTwoFactorUseCaseDeps {
  userRepository: IUserRepository;
  passwordHasher: IPasswordHasher;
}

/**
 * Settings > Security > Two-Factor Authentication (2026-07-22) - the "get me unstuck" escape
 * hatch: requires the current password (same posture as ChangeOwnPasswordUseCase), but
 * deliberately no OTP - a user who can no longer receive codes on their enabled channel (lost
 * phone, changed email) must still be able to turn 2FA back off.
 */
export class DisableTwoFactorUseCase {
  constructor(private readonly deps: DisableTwoFactorUseCaseDeps) {}

  async execute(input: DisableTwoFactorInput): Promise<void> {
    const user = await this.deps.userRepository.findById(input.userId);
    if (!user) throw new UserNotFoundError();

    const matches = await this.deps.passwordHasher.compare(input.currentPassword, user.passwordHash);
    if (!matches) throw new InvalidCredentialsError();

    await this.deps.userRepository.update(input.userId, { twoFactorEnabled: false, twoFactorChannel: null });
  }
}
