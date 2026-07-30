import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { IPortalAccountChallengeRepository } from '../ports/IPortalAccountChallengeRepository';
import type { ConfirmEnablePortalTwoFactorInput } from '../dtos/PortalAuthDtos';
import { PortalInvalidOtpError, PortalTooManyOtpAttemptsError, PortalAccountNotFoundError } from '../../domain/errors/PortalAuthErrors';

const MAX_OTP_ATTEMPTS = 5;

export interface ConfirmEnablePortalTwoFactorUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  portalAccountChallengeRepository: IPortalAccountChallengeRepository;
}

/** Portal Security > Two-Factor Authentication (2026-07-30) - step 2: proves the code from
 * RequestEnablePortalTwoFactorUseCase was actually received, then (and only then) turns 2FA on
 * with that channel. Mirrors identity's ConfirmTwoFactorSetupUseCase exactly. */
export class ConfirmEnablePortalTwoFactorUseCase {
  constructor(private readonly deps: ConfirmEnablePortalTwoFactorUseCaseDeps) {}

  async execute(input: ConfirmEnablePortalTwoFactorInput): Promise<void> {
    const { portalAccountRepository, portalAccountChallengeRepository } = this.deps;

    const challenge = await portalAccountChallengeRepository.findById(input.challengeId);
    // Ownership check (challenge.portalAccountId === input.portalAccountId) so one signed-in
    // client can never confirm a challenge sent to a different account's channel.
    if (
      !challenge ||
      challenge.portalAccountId !== input.portalAccountId ||
      challenge.purpose !== 'ENABLE_2FA' ||
      challenge.consumedAt ||
      challenge.expiresAt.getTime() < Date.now()
    ) {
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

    const account = await portalAccountRepository.findById(input.portalAccountId);
    if (!account) throw new PortalAccountNotFoundError();

    await portalAccountRepository.update(input.portalAccountId, { twoFactorEnabled: true, twoFactorChannel: challenge.channel });
  }
}
