import type { IUserRepository } from '../ports/IUserRepository';
import type { ITwoFactorChallengeRepository } from '../ports/ITwoFactorChallengeRepository';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import type { IAuditLogger } from '../ports/IAuditLogger';
import type { ConfirmPasswordResetInput } from '../dtos/AuthDtos';
import { PasswordPolicy } from '../../domain/PasswordPolicy';
import { InvalidOtpError, TooManyOtpAttemptsError, WeakPasswordError } from '../errors/AuthErrors';

const MAX_OTP_ATTEMPTS = 5;

export interface ConfirmPasswordResetUseCaseDeps {
  userRepository: IUserRepository;
  twoFactorChallengeRepository: ITwoFactorChallengeRepository;
  passwordHasher: IPasswordHasher;
  auditLogger?: IAuditLogger;
}

/**
 * Forgot Password (2026-07-28) - staff/LMS equivalent of the client-portal module's
 * ConfirmPasswordResetUseCase. Same challenge-verification shape as VerifyLoginOtpUseCase
 * (single InvalidOtpError for "doesn't exist," "wrong purpose," "already consumed," and
 * "expired" - never lets a caller distinguish which one occurred).
 *
 * Deliberately does NOT log the user in or issue tokens - unlike VerifyLoginOtpUseCase, this only
 * resets the password; the user still goes through the normal LoginPage afterwards with their new
 * credentials, exactly like ChangeOwnPasswordUseCase leaves the current session as-is.
 */
export class ConfirmPasswordResetUseCase {
  constructor(private readonly deps: ConfirmPasswordResetUseCaseDeps) {}

  async execute(input: ConfirmPasswordResetInput): Promise<void> {
    const { userRepository, twoFactorChallengeRepository, passwordHasher, auditLogger } = this.deps;

    const violations = PasswordPolicy.validate(input.newPassword);
    if (violations.length > 0) throw new WeakPasswordError(violations);

    const challenge = await twoFactorChallengeRepository.findById(input.challengeId);
    if (!challenge || challenge.purpose !== 'PASSWORD_RESET' || challenge.consumedAt || challenge.expiresAt.getTime() < Date.now()) {
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

    const passwordHash = await passwordHasher.hash(input.newPassword);
    await userRepository.update(challenge.userId, { passwordHash });

    if (auditLogger) {
      await auditLogger.log({
        userId: challenge.userId,
        action: 'PASSWORD_RESET',
        entityType: 'User',
        entityId: challenge.userId,
      });
    }
  }
}
