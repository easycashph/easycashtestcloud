import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { IPortalAccountChallengeRepository } from '../ports/IPortalAccountChallengeRepository';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import { matchBorrowerByEmail } from '@modules/borrower/application/services/MatchBorrowerByEmail';
import type { VerifySignUpInput } from '../dtos/PortalAuthDtos';
import { PortalInvalidOtpError, PortalTooManyOtpAttemptsError, PortalAccountNotFoundError } from '../../domain/errors/PortalAuthErrors';

const MAX_OTP_ATTEMPTS = 5;

export interface VerifySignUpUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  portalAccountChallengeRepository: IPortalAccountChallengeRepository;
  /** 2026-08-06 (Bind existing Client data to Portal, user request) - both optional: when present,
   * a newly-verified account is auto-matched against existing Borrower records by email so an
   * existing client's real loan data shows up in their portal the moment they finish signing up,
   * with no separate staff step needed. Silently skipped (same as CreateBorrowerUseCase's own
   * optional-portal-linking deps) if either dep is missing. */
  borrowerRepository?: IBorrowerRepository;
  auditLogger?: IAuditLogger;
}

/** Easycash Portal (2026-07-23, Phase 1) - confirms the SIGNUP challenge, then (and only then)
 * activates the account. Mirrors identity's ConfirmTwoFactorSetupUseCase shape closely. */
export class VerifySignUpUseCase {
  constructor(private readonly deps: VerifySignUpUseCaseDeps) {}

  async execute(input: VerifySignUpInput): Promise<void> {
    const { portalAccountRepository, portalAccountChallengeRepository, borrowerRepository, auditLogger } = this.deps;

    const challenge = await portalAccountChallengeRepository.findById(input.challengeId);
    // Same PortalInvalidOtpError regardless of which check failed - see that error's own doc
    // comment (enumeration-avoidance).
    if (!challenge || challenge.purpose !== 'SIGNUP' || challenge.consumedAt || challenge.expiresAt.getTime() < Date.now()) {
      throw new PortalInvalidOtpError();
    }
    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      throw new PortalTooManyOtpAttemptsError();
    }

    const consumed = await portalAccountChallengeRepository.verifyAndConsume(challenge.id, input.code);
    if (!consumed) {
      await portalAccountChallengeRepository.incrementAttempts(challenge.id);
      throw new PortalInvalidOtpError();
    }

    const account = await portalAccountRepository.findById(challenge.portalAccountId);
    if (!account) throw new PortalAccountNotFoundError();

    // Login 2FA (2026-07-30, default ON): populate twoFactorChannel with the channel this account
    // just proved it can receive - twoFactorEnabled already defaults to true at the DB level, so
    // this is the only piece needed for 2FA to actually kick in on first login. A client can
    // change/disable it later from Security.
    await portalAccountRepository.update(account.id, {
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      twoFactorChannel: challenge.channel,
    });

    // 2026-08-06 (Bind existing Client data to Portal, user request): best-effort auto-bind by
    // email - never blocks signup completion (the account is already ACTIVE above regardless of
    // what happens here). 0 matches = a genuinely new client, nothing to do. 1 match = the common
    // case (existing CP12-migrated client signing up for the first time). 2+ matches is a data-
    // quality situation (Borrower.email has no uniqueness constraint) - flagged via the audit log
    // for staff to resolve manually with the "Bind Existing Portal Account" action instead of
    // guessing which client this really is.
    if (borrowerRepository) {
      try {
        const match = await matchBorrowerByEmail(borrowerRepository, account.email);
        if (match.outcome === 'matched') {
          const alreadyLinked = await portalAccountRepository.findByBorrowerId(match.borrower.id);
          if (!alreadyLinked) {
            await portalAccountRepository.update(account.id, { borrowerId: match.borrower.id });
          }
        } else if (match.outcome === 'ambiguous') {
          await auditLogger?.log({
            action: 'portal_bind_ambiguous',
            entityType: 'PortalAccount',
            entityId: account.id,
            newValue: { email: account.email, candidateBorrowerIds: match.borrowerIds },
          });
        }
      } catch {
        // Never let a binding hiccup (e.g. a race on the unique borrowerId FK) fail an otherwise-
        // successful signup verification - same "auth flows must never mask this" posture as
        // IAuditLogger's own doc comment. The client can still be bound later via the staff-facing
        // "Bind Existing Portal Account" action.
      }
    }
  }
}
