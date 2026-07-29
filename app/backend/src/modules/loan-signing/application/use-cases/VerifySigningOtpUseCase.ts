import { SigningSessionExpiredError } from '../../domain/errors/LoanSigningDomainErrors';
import type { ILoanSigningSessionRepository } from '../ports/ILoanSigningSessionRepository';
import type { ISigningNotificationLogRepository } from '../ports/ISigningNotificationLogRepository';
import { hashSigningSecret } from '../../infrastructure/signingTokenHash';

export interface VerifySigningOtpUseCaseDeps {
  loanSigningSessionRepository: ILoanSigningSessionRepository;
  signingNotificationLogRepository: ISigningNotificationLogRepository;
}

/** Returns `true`/`false` for a correct/incorrect code rather than throwing on a mismatch - a
 * mistyped code is an expected user error the controller reports as a plain 400, not a 500.
 * Throws only for the session itself being gone/expired/revoked, or the domain's own
 * "OTP never requested"/"OTP expired" cases (`LoanSigningSession.verifyOtp`). */
export class VerifySigningOtpUseCase {
  constructor(private readonly deps: VerifySigningOtpUseCaseDeps) {}

  async execute(rawToken: string, code: string): Promise<boolean> {
    const tokenHash = hashSigningSecret(rawToken);
    const session = await this.deps.loanSigningSessionRepository.findByTokenHash(tokenHash);
    if (!session || session.isExpiredOrRevoked()) throw new SigningSessionExpiredError();

    const matched = session.verifyOtp(hashSigningSecret(code));
    await this.deps.loanSigningSessionRepository.save(session);
    if (matched) {
      // 2026-07-29 (user request): mark the OTP log row that was actually verified, so the log
      // shows which send succeeded vs. which earlier resends were superseded. Best-effort - never
      // block the real verification result on a logging failure.
      await this.deps.signingNotificationLogRepository.markLatestOtpVerified(session.id, new Date()).catch(() => undefined);
    }
    return matched;
  }
}
