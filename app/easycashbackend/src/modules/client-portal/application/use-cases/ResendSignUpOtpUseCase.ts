import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { IPortalAccountChallengeRepository } from '../ports/IPortalAccountChallengeRepository';
import type { IOtpSender } from '@modules/identity/application/ports/IOtpSender';
import type { ResendSignUpOtpInput } from '../dtos/PortalAuthDtos';
import { PortalInvalidOtpError, PortalAccountNotFoundError } from '../../domain/errors/PortalAuthErrors';
import { sendPortalOtp } from '../services/sendPortalOtp';
import { PORTAL_OTP_TTL_MS } from './SignUpUseCase';

export interface ResendSignUpOtpUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  portalAccountChallengeRepository: IPortalAccountChallengeRepository;
  otpSender: IOtpSender;
}

/**
 * Signup verification resend (2026-07-30 user request) - "Request another code" on the Verify
 * Email screen. Mirrors ResendPortalLoginOtpUseCase exactly: issues a brand-new SIGNUP challenge
 * (fresh code, fresh 5-minute expiry) on the SAME channel the original used, invalidates the old
 * challenge so it stops working the instant the new one is sent, and returns the new challengeId
 * for the frontend to swap in.
 */
export class ResendSignUpOtpUseCase {
  constructor(private readonly deps: ResendSignUpOtpUseCaseDeps) {}

  async execute(input: ResendSignUpOtpInput): Promise<{ challengeId: string; channel: string }> {
    const { portalAccountRepository, portalAccountChallengeRepository, otpSender } = this.deps;

    const oldChallenge = await portalAccountChallengeRepository.findById(input.challengeId);
    if (!oldChallenge || oldChallenge.purpose !== 'SIGNUP' || oldChallenge.consumedAt) {
      throw new PortalInvalidOtpError();
    }

    const account = await portalAccountRepository.findById(oldChallenge.portalAccountId);
    if (!account) throw new PortalAccountNotFoundError();

    const channel = oldChallenge.channel;
    const { id: challengeId, code } = await portalAccountChallengeRepository.create({
      portalAccountId: account.id,
      purpose: 'SIGNUP',
      channel,
      expiresAt: new Date(Date.now() + PORTAL_OTP_TTL_MS),
    });
    await portalAccountChallengeRepository.invalidate(oldChallenge.id);
    await sendPortalOtp(otpSender, channel, account.email, account.contactNumber, code);

    return { challengeId, channel };
  }
}
