import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { IPortalAccountChallengeRepository, PortalChallengeChannel } from '../ports/IPortalAccountChallengeRepository';
import type { IPortalTrustedDeviceRepository } from '../ports/IPortalTrustedDeviceRepository';
import type { IPortalTokenService } from '../ports/IPortalTokenService';
import type { VerifyPortalLoginOtpInput, PortalLoginOutput } from '../dtos/PortalAuthDtos';
import { PortalInvalidOtpError, PortalTooManyOtpAttemptsError, PortalAccountNotFoundError } from '../../domain/errors/PortalAuthErrors';

const MAX_OTP_ATTEMPTS = 5;
/** "Remember this device" (2026-07-30 user request) - how long a trusted-device token skips 2FA. */
const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface VerifyPortalLoginOtpUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  portalAccountChallengeRepository: IPortalAccountChallengeRepository;
  portalTrustedDeviceRepository: IPortalTrustedDeviceRepository;
  portalTokenService: IPortalTokenService;
}

/** Login 2FA (2026-07-30) - completes a login that PortalLoginUseCase paused on
 * `twoFactorRequired`. Mirrors identity's VerifyLoginOtpUseCase shape exactly, including the
 * "Remember this device" issuance (2026-07-30 user request). */
export class VerifyPortalLoginOtpUseCase {
  constructor(private readonly deps: VerifyPortalLoginOtpUseCaseDeps) {}

  async execute(input: VerifyPortalLoginOtpInput): Promise<PortalLoginOutput> {
    const { portalAccountRepository, portalAccountChallengeRepository, portalTrustedDeviceRepository, portalTokenService } = this.deps;

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

    const deviceToken = input.rememberDevice
      ? (
          await portalTrustedDeviceRepository.issue({
            portalAccountId: account.id,
            expiresAt: new Date(Date.now() + TRUSTED_DEVICE_TTL_MS),
          })
        ).rawToken
      : undefined;

    return {
      accessToken: token,
      accessTokenExpiresAt: expiresAt,
      ...(deviceToken ? { deviceToken } : {}),
      account: {
        id: account.id,
        email: account.email,
        contactNumber: account.contactNumber,
        borrowerId: account.borrowerId,
        twoFactorEnabled: account.twoFactorEnabled,
        twoFactorChannel: account.twoFactorChannel as PortalChallengeChannel | null,
        mustChangePassword: account.mustChangePassword,
      },
    };
  }
}
