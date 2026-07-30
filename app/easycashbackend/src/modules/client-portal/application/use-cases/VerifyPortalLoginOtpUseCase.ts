import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { IPortalAccountChallengeRepository, PortalChallengeChannel } from '../ports/IPortalAccountChallengeRepository';
import type { IPortalTokenService } from '../ports/IPortalTokenService';
import type { VerifyPortalLoginOtpInput, PortalLoginOutput } from '../dtos/PortalAuthDtos';
import { PortalInvalidOtpError, PortalTooManyOtpAttemptsError, PortalAccountNotFoundError } from '../../domain/errors/PortalAuthErrors';

const MAX_OTP_ATTEMPTS = 5;

export interface VerifyPortalLoginOtpUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  portalAccountChallengeRepository: IPortalAccountChallengeRepository;
  portalTokenService: IPortalTokenService;
}

/** Login 2FA (2026-07-30) - completes a login that PortalLoginUseCase paused on
 * `twoFactorRequired`. Mirrors identity's VerifyLoginOtpUseCase shape exactly. */
export class VerifyPortalLoginOtpUseCase {
  constructor(private readonly deps: VerifyPortalLoginOtpUseCaseDeps) {}

  async execute(input: VerifyPortalLoginOtpInput): Promise<PortalLoginOutput> {
    const { portalAccountRepository, portalAccountChallengeRepository, portalTokenService } = this.deps;

    const challenge = await portalAccountChallengeRepository.findById(input.challengeId);
    if (!challenge || challenge.purpose !== 'LOGIN' || challenge.consumedAt || challenge.expiresAt.getTime() < Date.now()) {
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

    const { token, expiresAt } = portalTokenService.signAccessToken({ sub: account.id, email: account.email });

    return {
      accessToken: token,
      accessTokenExpiresAt: expiresAt,
      account: {
        id: account.id,
        email: account.email,
        contactNumber: account.contactNumber,
        borrowerId: account.borrowerId,
        twoFactorEnabled: account.twoFactorEnabled,
        twoFactorChannel: account.twoFactorChannel as PortalChallengeChannel | null,
      },
    };
  }
}
