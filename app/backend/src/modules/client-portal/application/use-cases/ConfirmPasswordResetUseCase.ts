import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { IPortalAccountChallengeRepository } from '../ports/IPortalAccountChallengeRepository';
import type { IPasswordHasher } from '@modules/identity/application/ports/IPasswordHasher';
import { PasswordPolicy } from '@modules/identity/domain/PasswordPolicy';
import type { ConfirmPasswordResetInput } from '../dtos/PortalAuthDtos';
import { PortalInvalidOtpError, PortalTooManyOtpAttemptsError, PortalWeakPasswordError } from '../../domain/errors/PortalAuthErrors';

const MAX_OTP_ATTEMPTS = 5;

export interface ConfirmPasswordResetUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  portalAccountChallengeRepository: IPortalAccountChallengeRepository;
  passwordHasher: IPasswordHasher;
}

export class ConfirmPasswordResetUseCase {
  constructor(private readonly deps: ConfirmPasswordResetUseCaseDeps) {}

  async execute(input: ConfirmPasswordResetInput): Promise<void> {
    const { portalAccountRepository, portalAccountChallengeRepository, passwordHasher } = this.deps;

    const violations = PasswordPolicy.validate(input.newPassword);
    if (violations.length > 0) throw new PortalWeakPasswordError(violations);

    const challenge = await portalAccountChallengeRepository.findById(input.challengeId);
    if (!challenge || challenge.purpose !== 'PASSWORD_RESET' || challenge.consumedAt || challenge.expiresAt.getTime() < Date.now()) {
      throw new PortalInvalidOtpError();
    }
    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      throw new PortalTooManyOtpAttemptsError();
    }

    const consumed = await portalAccountChallengeRepository.verifyAndConsume(challenge.id, input.code);
    if (!consumed) {
      await portalAccountChallengeRepository.incrementAttempts(challenge.id);
      throw new PortalInvalidOtpError();
    }

    const passwordHash = await passwordHasher.hash(input.newPassword);
    await portalAccountRepository.update(challenge.portalAccountId, { passwordHash });
  }
}
