import type { IPortalAccountRepository } from '@modules/client-portal/application/ports/IPortalAccountRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { ILoanSigningSessionRepository } from '../../ports/ILoanSigningSessionRepository';
import type { ISigningNotificationLogRepository } from '../../ports/ISigningNotificationLogRepository';
import { hashSigningSecret } from '../../../infrastructure/signingTokenHash';
import { resolvePortalSigningSession } from './resolvePortalSigningSession';

/** 2026-08-20 (Portal e-signature, user request): Portal-authenticated counterpart of
 * `VerifySigningOtpUseCase` - same "return false on mismatch, throw only for a gone/expired
 * session" behavior, resolved by `sessionId + portalAccountId`. */
export class VerifyPortalSigningOtpUseCase {
  constructor(
    private readonly deps: {
      loanSigningSessionRepository: ILoanSigningSessionRepository;
      portalAccountRepository: IPortalAccountRepository;
      loanAccountRepository: ILoanAccountRepository;
      signingNotificationLogRepository: ISigningNotificationLogRepository;
    },
  ) {}

  async execute(sessionId: string, portalAccountId: string, code: string): Promise<boolean> {
    const session = await resolvePortalSigningSession(sessionId, portalAccountId, this.deps);

    const matched = session.verifyOtp(hashSigningSecret(code));
    await this.deps.loanSigningSessionRepository.save(session);
    if (matched) {
      await this.deps.signingNotificationLogRepository.markLatestOtpVerified(session.id, new Date()).catch(() => undefined);
    }
    return matched;
  }
}
