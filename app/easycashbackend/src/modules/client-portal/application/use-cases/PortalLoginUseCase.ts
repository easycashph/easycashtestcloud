import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { IPortalAccountChallengeRepository, PortalChallengeChannel } from '../ports/IPortalAccountChallengeRepository';
import type { IPortalTrustedDeviceRepository } from '../ports/IPortalTrustedDeviceRepository';
import type { IPasswordHasher } from '@modules/identity/application/ports/IPasswordHasher';
import type { IOtpSender } from '@modules/identity/application/ports/IOtpSender';
import type { IPortalTokenService } from '../ports/IPortalTokenService';
import type { PortalLoginInput, PortalLoginResult } from '../dtos/PortalAuthDtos';
import { PortalInvalidCredentialsError, PortalAccountNotVerifiedError, PortalAccountDeletedError } from '../../domain/errors/PortalAuthErrors';
import { sendPortalOtp } from '../services/sendPortalOtp';

export const PORTAL_LOGIN_OTP_TTL_MS = 5 * 60 * 1000;

export interface PortalLoginUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  passwordHasher: IPasswordHasher;
  portalTokenService: IPortalTokenService;
  portalAccountChallengeRepository: IPortalAccountChallengeRepository;
  portalTrustedDeviceRepository: IPortalTrustedDeviceRepository;
  otpSender: IOtpSender;
}

/**
 * Easycash Portal (2026-07-23, Phase 1) - v1 scope: a single access token, no refresh-token
 * rotation yet (see PORTAL_JWT_TTL's doc comment in shared/config/env.ts).
 *
 * 2026-07-30 (Login 2FA, user request) - once credentials check out, an account with
 * `twoFactorEnabled` gets a LOGIN-purpose challenge instead of a token - the caller must complete
 * VerifyPortalLoginOtpUseCase next. Mirrors identity's LoginUseCase branch exactly.
 *
 * 2026-07-30 ("Remember this device", user request) - a valid, unexpired PortalTrustedDevice token
 * skips the 2FA challenge entirely, same as identity's LoginUseCase.
 */
export class PortalLoginUseCase {
  constructor(private readonly deps: PortalLoginUseCaseDeps) {}

  async execute(input: PortalLoginInput): Promise<PortalLoginResult> {
    const { portalAccountRepository, passwordHasher, portalTokenService, portalAccountChallengeRepository, portalTrustedDeviceRepository, otpSender } =
      this.deps;

    const account = await portalAccountRepository.findByEmail(input.email);

    // Always run a bcrypt comparison, even for an unknown email, against a fixed dummy hash -
    // same timing-attack mitigation as identity's LoginUseCase.
    const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO0Ku4CU9jGkxN.zn.b3F2hAtBcqfNjGO';
    const passwordMatches = await passwordHasher.compare(input.password, account?.passwordHash ?? DUMMY_HASH);

    if (!account || !passwordMatches) {
      throw new PortalInvalidCredentialsError();
    }
    // 2026-08-06 (Delete My Portal Account) - a distinct, clearer error than the generic
    // "not verified" one below for an account the client deleted themselves.
    if (account.status === 'DELETED') {
      throw new PortalAccountDeletedError();
    }
    if (account.status !== 'ACTIVE') {
      throw new PortalAccountNotVerifiedError();
    }

    const trustedDevice = input.deviceToken ? await portalTrustedDeviceRepository.findValidByRawToken(input.deviceToken) : null;
    const skip2fa = trustedDevice?.portalAccountId === account.id;

    if (account.twoFactorEnabled && account.twoFactorChannel && !skip2fa) {
      const channel = account.twoFactorChannel as PortalChallengeChannel;
      const { id: challengeId, code } = await portalAccountChallengeRepository.create({
        portalAccountId: account.id,
        purpose: 'LOGIN',
        channel,
        expiresAt: new Date(Date.now() + PORTAL_LOGIN_OTP_TTL_MS),
      });
      await sendPortalOtp(otpSender, channel, account.email, account.contactNumber, code);
      return { twoFactorRequired: true, challengeId, channel };
    }

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
        mustChangePassword: account.mustChangePassword,
      },
    };
  }
}
