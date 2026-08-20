import { NotFoundError } from '@shared/errors/DomainError';
import type { IPortalAccountRepository } from '@modules/client-portal/application/ports/IPortalAccountRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import { SigningSessionExpiredError } from '../../../domain/errors/LoanSigningDomainErrors';
import type { ILoanSigningSessionRepository } from '../../ports/ILoanSigningSessionRepository';
import type { LoanSigningSession } from '../../../domain/LoanSigningSession';

/**
 * 2026-08-20 (Portal e-signature, user request): shared session-resolution + ownership check every
 * Portal-side signing use-case needs. Mirrors what the PUBLIC token-based use-cases do
 * (`hashSigningSecret(rawToken)` -> `findByTokenHash`), but a Portal-authenticated caller has
 * neither a raw token nor a tokenHash to look up by - the borrower is already identified by their
 * portal JWT (`portalAccountId`), so this resolves by `sessionId` instead and checks that the
 * session's `LoanAccount.borrowerId` actually belongs to that portal account.
 *
 * Deliberately scoped to `partyType === 'BORROWER'` sessions only - a co-borrower is a different
 * person from the logged-in portal account and has no portal login of their own (Phase 1); a
 * `CO_BORROWER` session stays reachable only via its mailed link, same as before this feature.
 *
 * Returns `NotFoundError` (404) rather than a generic 403 for an ownership mismatch or a
 * `CO_BORROWER` session - deliberately doesn't reveal "this session exists but isn't yours" to an
 * authenticated-but-unrelated portal account.
 */
export async function resolvePortalSigningSession(
  sessionId: string,
  portalAccountId: string,
  deps: {
    loanSigningSessionRepository: ILoanSigningSessionRepository;
    portalAccountRepository: IPortalAccountRepository;
    loanAccountRepository: ILoanAccountRepository;
  },
): Promise<LoanSigningSession> {
  const session = await deps.loanSigningSessionRepository.findById(sessionId);
  if (!session || session.isExpiredOrRevoked()) throw new SigningSessionExpiredError();
  if (session.partyType !== 'BORROWER') throw new NotFoundError('LoanSigningSession', sessionId);

  const portalAccount = await deps.portalAccountRepository.findById(portalAccountId);
  if (!portalAccount?.borrowerId) throw new NotFoundError('LoanSigningSession', sessionId);

  const loanAccount = await deps.loanAccountRepository.findById(session.loanAccountId);
  if (!loanAccount || loanAccount.borrowerId !== portalAccount.borrowerId) {
    throw new NotFoundError('LoanSigningSession', sessionId);
  }

  return session;
}
