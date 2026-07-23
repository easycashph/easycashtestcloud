import type { IUserRepository } from '../ports/IUserRepository';
import type { ITwoFactorChallengeRepository } from '../ports/ITwoFactorChallengeRepository';
import type { ConfirmTwoFactorSetupInput } from '../dtos/AuthDtos';
import { InvalidOtpError, TooManyOtpAttemptsError, UserNotFoundError } from '../errors/AuthErrors';

const MAX_OTP_ATTEMPTS = 5;

export interface ConfirmTwoFactorSetupUseCaseDeps {
  userRepository: IUserRepository;
  twoFactorChallengeRepository: ITwoFactorChallengeRepository;
}

/** Settings > Security > Two-Factor Authentication (2026-07-22) - step 2: proves the code from
 * RequestTwoFactorSetupUseCase was actually received, then (and only then) turns 2FA on. */
export class ConfirmTwoFactorSetupUseCase {
  constructor(private readonly deps: ConfirmTwoFactorSetupUseCaseDeps) {}

  async execute(input: ConfirmTwoFactorSetupInput): Promise<void> {
    const { userRepository, twoFactorChallengeRepository } = this.deps;

    const challenge = await twoFactorChallengeRepository.findById(input.challengeId);
    // Same InvalidOtpError regardless of which check failed - see that error's own doc comment.
    // Ownership (`challenge.userId === input.userId`) is checked here too, so one signed-in user
    // can never confirm a challenge that was sent to someone else's channel.
    if (
      !challenge ||
      challenge.userId !== input.userId ||
      challenge.purpose !== 'ENABLE' ||
      challenge.consumedAt ||
      challenge.expiresAt.getTime() < Date.now()
    ) {
      throw new InvalidOtpError();
    }
    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      throw new TooManyOtpAttemptsError();
    }

    const consumed = await twoFactorChallengeRepository.verifyAndConsume(challenge.id, input.code);
    if (!consumed) {
      await twoFactorChallengeRepository.incrementAttempts(challenge.id);
      throw new InvalidOtpError();
    }

    const user = await userRepository.findById(input.userId);
    if (!user) throw new UserNotFoundError();

    await userRepository.update(input.userId, { twoFactorEnabled: true, twoFactorChannel: challenge.channel });
  }
}
