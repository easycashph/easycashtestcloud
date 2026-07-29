import type { ISmsGateway } from '@modules/sms-reminder/application/ports/ISmsGateway';
import type { IEmailGateway } from '@modules/email-reminder/application/ports/IEmailGateway';
import { SigningSessionExpiredError } from '../../domain/errors/LoanSigningDomainErrors';
import type { ILoanSigningSessionRepository } from '../ports/ILoanSigningSessionRepository';
import type { ISigningNotificationLogRepository } from '../ports/ISigningNotificationLogRepository';
import { generateOtpCode, hashSigningSecret } from '../../infrastructure/signingTokenHash';

const OTP_TTL_MINUTES = 5;

export interface RequestSigningOtpUseCaseDeps {
  loanSigningSessionRepository: ILoanSigningSessionRepository;
  signingNotificationLogRepository: ISigningNotificationLogRepository;
  smsGateway: ISmsGateway;
  emailGateway: IEmailGateway;
}

/** Called when the client opens the signing link (or taps "Resend code"). Generates a fresh
 * 6-digit OTP every time - a previously issued, unverified code is simply superseded.
 *
 * 2026-07-28: the OTP is delivered via the SAME channel the link itself used (`session.channel`) -
 * not hardcoded to SMS - so an EMAIL-channel session also gets its OTP by email. */
export class RequestSigningOtpUseCase {
  constructor(private readonly deps: RequestSigningOtpUseCaseDeps) {}

  async execute(rawToken: string): Promise<void> {
    const tokenHash = hashSigningSecret(rawToken);
    const session = await this.deps.loanSigningSessionRepository.findByTokenHash(tokenHash);
    if (!session || session.isExpiredOrRevoked()) throw new SigningSessionExpiredError();

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

    // 2026-07-29 (user request): log every OTP send, same "best-effort, never block the real send"
    // posture as the LINK log in CreateLoanSigningSessionUseCase.
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
