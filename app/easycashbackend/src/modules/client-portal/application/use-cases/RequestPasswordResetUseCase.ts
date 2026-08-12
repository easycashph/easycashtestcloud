import { randomUUID } from 'node:crypto';
import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { IPortalAccountChallengeRepository } from '../ports/IPortalAccountChallengeRepository';
import type { IOtpSender } from '@modules/identity/application/ports/IOtpSender';
import type { RequestPasswordResetInput, RequestPasswordResetOutput } from '../dtos/PortalAuthDtos';
import { PORTAL_OTP_TTL_MS } from './SignUpUseCase';

export interface RequestPasswordResetUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  portalAccountChallengeRepository: IPortalAccountChallengeRepository;
  otpSender: IOtpSender;
}

/**
 * Easycash Portal (2026-07-23, Phase 1) - always returns a challengeId-shaped response, even for
 * an email that matches no account, so a caller can never distinguish "no such account" from "code
 * sent" by inspecting the response shape (only a real account's code is ever actually sent/usable -
 * the fake id returned for a non-existent account will simply never match a real challenge in
 * ConfirmPasswordResetUseCase, failing exactly like a wrong code would).
 *
 * 2026-08-12 (user request/bug fix): PENDING_VERIFICATION accounts are now allowed to request a
 * reset too, not just ACTIVE - clients who got stuck at signup (never verified, or whose original
 * verification code expired) had no way back into their account since password reset was the one
 * flow that could prove email ownership and recover them. ConfirmPasswordResetUseCase promotes the
 * account to ACTIVE on successful confirmation for exactly this reason.
 */
export class RequestPasswordResetUseCase {
  constructor(private readonly deps: RequestPasswordResetUseCaseDeps) {}

  async execute(input: RequestPasswordResetInput): Promise<RequestPasswordResetOutput> {
    const { portalAccountRepository, portalAccountChallengeRepository, otpSender } = this.deps;

    const account = await portalAccountRepository.findByEmail(input.email);
    if (!account || (account.status !== 'ACTIVE' && account.status !== 'PENDING_VERIFICATION')) {
      return { challengeId: randomUUID() };
    }

    const { id: challengeId, code } = await portalAccountChallengeRepository.create({
      portalAccountId: account.id,
      purpose: 'PASSWORD_RESET',
      channel: 'EMAIL',
      expiresAt: new Date(Date.now() + PORTAL_OTP_TTL_MS),
    });
    await otpSender.send('EMAIL', account.email, code);

    return { challengeId };
  }
}
