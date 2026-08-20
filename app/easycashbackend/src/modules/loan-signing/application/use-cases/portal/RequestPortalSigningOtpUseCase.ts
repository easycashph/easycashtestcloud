import type { IPortalAccountRepository } from '@modules/client-portal/application/ports/IPortalAccountRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { ISmsGateway } from '@modules/sms-reminder/application/ports/ISmsGateway';
import type { IEmailGateway } from '@modules/email-reminder/application/ports/IEmailGateway';
import type { ILoanSigningSessionRepository } from '../../ports/ILoanSigningSessionRepository';
import type { ISigningNotificationLogRepository } from '../../ports/ISigningNotificationLogRepository';
import { generateOtpCode, hashSigningSecret } from '../../../infrastructure/signingTokenHash';
import { resolvePortalSigningSession } from './resolvePortalSigningSession';

const OTP_TTL_MINUTES = 5;

/**
 * 2026-08-20 (Portal e-signature, user request): Portal-authenticated counterpart of
 * `RequestSigningOtpUseCase` - identical OTP generation/delivery logic, resolved by
 * `sessionId + portalAccountId` instead of a raw link token. OTP verification is kept even for an
 * already-logged-in Portal user (not skipped) - being logged into the Portal proves "this browser
 * has valid Portal credentials," the OTP additionally proves "this person also controls the
 * phone/email on file for this loan," which matters for a legally-binding signature.
 */
export class RequestPortalSigningOtpUseCase {
  constructor(
    private readonly deps: {
      loanSigningSessionRepository: ILoanSigningSessionRepository;
      portalAccountRepository: IPortalAccountRepository;
      loanAccountRepository: ILoanAccountRepository;
      signingNotificationLogRepository: ISigningNotificationLogRepository;
      smsGateway: ISmsGateway;
      emailGateway: IEmailGateway;
    },
  ) {}

  async execute(sessionId: string, portalAccountId: string): Promise<void> {
    const session = await resolvePortalSigningSession(sessionId, portalAccountId, this.deps);

    const otpCode = generateOtpCode();
    session.setOtp(hashSigningSecret(otpCode), new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000));
    await this.deps.loanSigningSessionRepository.save(session);

    const messageBody = `Easycash: Your loan document signing code is ${otpCode}. Valid for ${OTP_TTL_MINUTES} minutes. Do not share this code.`;
    let recipient: string;
    if (session.channel === 'EMAIL' && session.email) {
      recipient = session.email;
      await this.deps.emailGateway.send(session.email, 'Easycash: Your loan document signing code', messageBody);
    } else {
      recipient = session.phoneNumber;
      await this.deps.smsGateway.send(session.phoneNumber, messageBody);
    }

    await this.deps.signingNotificationLogRepository
      .create({
        loanSigningSessionId: session.id,
        loanAccountId: session.loanAccountId,
        type: 'OTP',
        partyType: session.partyType,
        channel: session.channel === 'EMAIL' && session.email ? 'EMAIL' : 'SMS',
        recipient,
      })
      .catch(() => undefined);
  }
}
