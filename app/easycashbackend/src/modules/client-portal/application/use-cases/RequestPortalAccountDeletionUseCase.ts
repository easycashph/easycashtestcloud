import { randomUUID } from 'node:crypto';
import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { IPasswordHasher } from '@modules/identity/application/ports/IPasswordHasher';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import { PortalAccountNotFoundError, PortalInvalidCredentialsError, PortalAccountHasActiveLoanError } from '../../domain/errors/PortalAuthErrors';

/** Mirrors the LMS's own "has an open loan" gates (e.g. CreateLoanApplicationUseCase's
 * CLOSED_LOAN_ACCOUNT_STATUSES, ClientProfilePage's ACTIVE_LOAN_STATUSES) - a loan is "active" for
 * this check if it's neither closed nor still pre-disbursement. */
const ACTIVE_LOAN_ACCOUNT_STATUSES = new Set(['ACTIVE', 'ACTIVE_IN_ARREARS']);

export interface RequestPortalAccountDeletionUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  loanAccountRepository: ILoanAccountRepository;
  passwordHasher: IPasswordHasher;
  auditLogger?: IAuditLogger;
}

/**
 * "Delete My Portal Account" (2026-08-06, Security tab, explicit user decision/disclosure):
 * deletes ONLY this client's Portal login - never their Borrower profile or loan history/records,
 * which stay exactly as they are in the LMS regardless. Blocked entirely while any linked
 * LoanAccount is still ACTIVE/ACTIVE_IN_ARREARS, so a client can't lock themselves out of a loan
 * they're still paying off.
 *
 * A soft status flip (`status: 'DELETED'`) plus password invalidation, not a real SQL DELETE - see
 * `PortalAccountStatus`'s own doc comment on the schema for why (FK-restrict risk on
 * `LoanApplication.portalAccountId`, and this codebase's existing `User.status`-based deactivation
 * convention has no precedent for hard-deleting a row at all).
 */
export class RequestPortalAccountDeletionUseCase {
  constructor(private readonly deps: RequestPortalAccountDeletionUseCaseDeps) {}

  async execute(portalAccountId: string, currentPassword: string): Promise<void> {
    const { portalAccountRepository, loanAccountRepository, passwordHasher, auditLogger } = this.deps;

    const account = await portalAccountRepository.findById(portalAccountId);
    if (!account) throw new PortalAccountNotFoundError();

    const matches = await passwordHasher.compare(currentPassword, account.passwordHash);
    if (!matches) throw new PortalInvalidCredentialsError();

    if (account.borrowerId) {
      const loanAccounts = await loanAccountRepository.findMany({ borrowerId: account.borrowerId, limit: 200 });
      const hasActiveLoan = loanAccounts.some((loan) => ACTIVE_LOAN_ACCOUNT_STATUSES.has(loan.status));
      if (hasActiveLoan) throw new PortalAccountHasActiveLoanError();
    }

    // Invalidates the old password outright (a random, never-communicated value) rather than just
    // flipping status - belt-and-suspenders in case any future code path ever checks credentials
    // without also checking status first.
    const invalidatedPasswordHash = await passwordHasher.hash(randomUUID());
    // Frees both unique constraints (`email`, `borrowerId`) this row was holding, so the deletion
    // is not a permanent dead end: the client can sign up again with the same email later, and
    // staff can immediately re-issue a fresh Portal account for the same Borrower via "Create
    // Portal Account" without this now-defunct row blocking either path. The real email is
    // preserved in the audit log entry below, not lost.
    const releasedEmail = `deleted+${account.id}@deleted.easycashportal.invalid`;
    await portalAccountRepository.update(account.id, {
      status: 'DELETED',
      passwordHash: invalidatedPasswordHash,
      email: releasedEmail,
      borrowerId: null,
    });

    await auditLogger?.log({
      action: 'portal_account_self_deleted',
      entityType: 'PortalAccount',
      entityId: account.id,
      previousValue: { status: account.status, email: account.email, borrowerId: account.borrowerId },
      newValue: { status: 'DELETED' },
    });
  }
}
