import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { IPortalAccountChallengeRepository, PortalChallengeChannel } from '../ports/IPortalAccountChallengeRepository';
import type { IOtpSender } from '@modules/identity/application/ports/IOtpSender';
import type { ResendPortalLoginOtpInput, PortalLoginTwoFactorRequired } from '../dtos/PortalAuthDtos';
import { PortalInvalidOtpError, PortalAccountNotFoundError } from '../../domain/errors/PortalAuthErrors';
import { sendPortalOtp } from '../services/sendPortalOtp';
import { PORTAL_LOGIN_OTP_TTL_MS } from './PortalLoginUseCase';

export interface ResendPortalLoginOtpUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  portalAccountChallengeRepository: IPortalAccountChallengeRepository;
  otpSender: IOtpSender;
}

/**
 * Login 2FA resend (2026-07-30 user request) - a client stuck on the OTP screen (code never
 * arrived, or the 5-minute window ran out) can get a fresh code without starting the login over.
 *
 * Deliberately does NOT reuse the old challenge row - issues a brand-new LOGIN challenge (fresh
 * code, fresh 5-minute expiry, `attempts` reset to 0) and returns its id, same as if
 * PortalLoginUseCase had just paused on `twoFactorRequired` again. The old challenge is explicitly
 * invalidated (not just left to expire naturally) so the old code stops working the instant a new
 * one is sent - otherwise both codes would remain valid in parallel until the old one's own
 * 5-minute window lapsed, needlessly widening the window an intercepted/leaked old code stays live.
 *
 * The old challenge must still be a legitimate, not-yet-consumed LOGIN challenge to resend against
 * - this endpoint proves "you were mid-login a moment ago," not "you know any random id," so it
 * can't be used to silently re-trigger an OTP send for an arbitrary account.
 */
export class ResendPortalLoginOtpUseCase {
  constructor(private readonly deps: ResendPortalLoginOtpUseCaseDeps) {}

  async execute(input: ResendPortalLoginOtpInput): Promise<PortalLoginTwoFactorRequired> {
    const { portalAccountRepository, portalAccountChallengeRepository, otpSender } = this.deps;

    const oldChallenge = await portalAccountChallengeRepository.findById(input.challengeId);
    // Same InvalidOtpError as everywhere else here - not consumed yet is required, but a merely
    // EXPIRED old challenge is fine (that's the exact case this endpoint exists for).
    if (!oldChallenge || oldChallenge.purpose !== 'LOGIN' || oldChallenge.consumedAt) {
      throw new PortalInvalidOtpError();
    }

    const account = await portalAccountRepository.findById(oldChallenge.portalAccountId);
    if (!account) throw new PortalAccountNotFoundError();

    const channel = oldChallenge.channel;

    const { id: challengeId, code } = await portalAccountChallengeRepository.create({
      portalAccountId: account.id,
      purpose: 'LOGIN',
      channel,
      expiresAt: new Date(Date.now() + PORTAL_LOGIN_OTP_TTL_MS),
    });
    await portalAccountChallengeRepository.invalidate(oldChallenge.id);
    await sendPortalOtp(otpSender, channel, account.email, account.contactNumber, code);

    return { twoFactorRequired: true, challengeId, channel: channel as PortalChallengeChannel };
  }
}
