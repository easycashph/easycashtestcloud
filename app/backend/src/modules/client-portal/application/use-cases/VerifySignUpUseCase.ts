import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { IPortalAccountChallengeRepository } from '../ports/IPortalAccountChallengeRepository';
import type { VerifySignUpInput } from '../dtos/PortalAuthDtos';
import { PortalInvalidOtpError, PortalTooManyOtpAttemptsError, PortalAccountNotFoundError } from '../../domain/errors/PortalAuthErrors';

const MAX_OTP_ATTEMPTS = 5;

export interface VerifySignUpUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  portalAccountChallengeRepository: IPortalAccountChallengeRepository;
}

/** Easycash Portal (2026-07-23, Phase 1) - confirms the SIGNUP challenge, then (and only then)
 * activates the account. Mirrors identity's ConfirmTwoFactorSetupUseCase shape closely. */
export class VerifySignUpUseCase {
  constructor(private readonly deps: VerifySignUpUseCaseDeps) {}

  async execute(input: VerifySignUpInput): Promise<void> {
    const { portalAccountRepository, portalAccountChallengeRepository } = this.deps;

    const challenge = await portalAccountChallengeRepository.findById(input.challengeId);
    // Same PortalInvalidOtpError regardless of which check failed - see that error's own doc
    // comment (enumeration-avoidance).
    if (!challenge || challenge.purpose !== 'SIGNUP' || challenge.consumedAt || challenge.expiresAt.getTime() < Date.now()) {
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

    const account = await portalAccountRepository.findById(challenge.portalAccountId);
    if (!account) throw new PortalAccountNotFoundError();

    await portalAccountRepository.update(account.id, { status: 'ACTIVE', emailVerifiedAt: new Date() });
  }
}
