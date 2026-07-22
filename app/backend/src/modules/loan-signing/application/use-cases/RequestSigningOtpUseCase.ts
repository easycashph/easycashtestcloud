import type { ISmsGateway } from '@modules/sms-reminder/application/ports/ISmsGateway';
import { SigningSessionExpiredError } from '../../domain/errors/LoanSigningDomainErrors';
import type { ILoanSigningSessionRepository } from '../ports/ILoanSigningSessionRepository';
import { generateOtpCode, hashSigningSecret } from '../../infrastructure/signingTokenHash';

const OTP_TTL_MINUTES = 5;

export interface RequestSigningOtpUseCaseDeps {
  loanSigningSessionRepository: ILoanSigningSessionRepository;
  smsGateway: ISmsGateway;
}

/** Called when the client opens the signing link (or taps "Resend code"). Generates a fresh
 * 6-digit OTP every time - a previously issued, unverified code is simply superseded. */
export class RequestSigningOtpUseCase {
  constructor(private readonly deps: RequestSigningOtpUseCaseDeps) {}

  async execute(rawToken: string): Promise<void> {
    const tokenHash = hashSigningSecret(rawToken);
    const session = await this.deps.loanSigningSessionRepository.findByTokenHash(tokenHash);
    if (!session || session.isExpiredOrRevoked()) throw new SigningSessionExpiredError();

    const otpCode = generateOtpCode();
    session.setOtp(hashSigningSecret(otpCode), new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000));
    await this.deps.loanSigningSessionRepository.save(session);

    await this.deps.smsGateway.send(
      session.phoneNumber,
      `Easycash: Your loan document signing code is ${otpCode}. Valid for ${OTP_TTL_MINUTES} minutes. Do not share this code.`,
    );
  }
}
