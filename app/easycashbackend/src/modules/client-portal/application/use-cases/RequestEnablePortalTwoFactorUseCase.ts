import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { IPortalAccountChallengeRepository } from '../ports/IPortalAccountChallengeRepository';
import type { IOtpSender } from '@modules/identity/application/ports/IOtpSender';
import type { RequestEnablePortalTwoFactorInput, RequestEnablePortalTwoFactorOutput } from '../dtos/PortalAuthDtos';
import { PortalAccountNotFoundError, PortalTwoFactorChannelUnavailableError } from '../../domain/errors/PortalAuthErrors';
import { PORTAL_LOGIN_OTP_TTL_MS } from './PortalLoginUseCase';

export interface RequestEnablePortalTwoFactorUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  portalAccountChallengeRepository: IPortalAccountChallengeRepository;
  otpSender: IOtpSender;
}

/** Portal Security > Two-Factor Authentication (2026-07-30) - step 1 of turning 2FA (back) on or
 * switching channel: send a code, but don't flip `twoFactorEnabled` yet - only
 * ConfirmEnablePortalTwoFactorUseCase does that, once the code is proven reachable. Mirrors
 * identity's RequestTwoFactorSetupUseCase exactly. */
export class RequestEnablePortalTwoFactorUseCase {
  constructor(private readonly deps: RequestEnablePortalTwoFactorUseCaseDeps) {}

  async execute(input: RequestEnablePortalTwoFactorInput): Promise<RequestEnablePortalTwoFactorOutput> {
    const { portalAccountRepository, portalAccountChallengeRepository, otpSender } = this.deps;

    const account = await portalAccountRepository.findById(input.portalAccountId);
    if (!account) throw new PortalAccountNotFoundError();

    const destination = input.channel === 'EMAIL' ? account.email : account.contactNumber;
    if (!destination) throw new PortalTwoFactorChannelUnavailableError(input.channel);

    const { id: challengeId, code } = await portalAccountChallengeRepository.create({
      portalAccountId: account.id,
      purpose: 'ENABLE_2FA',
      channel: input.channel,
      expiresAt: new Date(Date.now() + PORTAL_LOGIN_OTP_TTL_MS),
    });
    await otpSender.send(input.channel, destination, code);

    return { challengeId };
  }
}
