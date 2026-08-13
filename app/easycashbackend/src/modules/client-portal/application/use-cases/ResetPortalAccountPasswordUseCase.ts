import { randomBytes } from 'node:crypto';
import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { IPasswordHasher } from '@modules/identity/application/ports/IPasswordHasher';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import { NotFoundError } from '@shared/errors/DomainError';
import { BorrowerPortalAccountNotLinkedError } from '@modules/borrower/domain/errors/BorrowerDomainErrors';
import { PortalAccountDeletedError } from '../../domain/errors/PortalAuthErrors';
import { PasswordPolicy } from '@modules/identity/domain/PasswordPolicy';

export interface ResetPortalAccountPasswordUseCaseDeps {
  borrowerRepository: IBorrowerRepository;
  portalAccountRepository: IPortalAccountRepository;
  passwordHasher: IPasswordHasher;
  profileActivityLogService?: ProfileActivityLogService;
}

export interface ResetPortalAccountPasswordOutput {
  portalAccountId: string;
  email: string;
  temporaryPassword: string;
}

/** Generates a fresh, random one-time temporary password - deliberately NOT the fixed
 * STAFF_ISSUED_TEMP_PASSWORD constant used by CreatePortalAccountForBorrowerUseCase (2026-08-13
 * user decision): a reset should never leave the account behind a password anyone could guess or
 * that's shared/reused across every other locked-out client, unlike the one-time initial-creation
 * case that constant covers. Base64url keeps it URL/copy-paste safe; comfortably clears
 * PasswordPolicy.MIN_LENGTH (12) at any reasonable byte count. */
function generateTemporaryPassword(): string {
  return randomBytes(12).toString('base64url');
}

/** Staff-facing "Reset Password" action (Client Profile page, MIS-only) - for an existing client
 * portal account that's locked out, forgotten its password, or otherwise can't complete
 * self-service recovery. Unlike RequestPasswordResetUseCase (client-initiated, requires an OTP the
 * client proves ownership of), this is a direct staff override - safe only because the same
 * `mustChangePassword` gate CreatePortalAccountForBorrowerUseCase relies on immediately locks the
 * account back down to "must set a real password" on next login, and because staff already
 * confirmed the client's identity in person/by phone before triggering this (same trust
 * justification as walk-in creation). */
export class ResetPortalAccountPasswordUseCase {
  constructor(private readonly deps: ResetPortalAccountPasswordUseCaseDeps) {}

  async execute(borrowerId: string, staffUserId: string): Promise<ResetPortalAccountPasswordOutput> {
    const { borrowerRepository, portalAccountRepository, passwordHasher, profileActivityLogService } = this.deps;

    const borrower = await borrowerRepository.findById(borrowerId);
    if (!borrower) throw new NotFoundError('Borrower', borrowerId);

    const account = await portalAccountRepository.findByBorrowerId(borrowerId);
    if (!account) throw new BorrowerPortalAccountNotLinkedError(borrowerId);
    if (account.status === 'DELETED') throw new PortalAccountDeletedError();

    const temporaryPassword = generateTemporaryPassword();
    // Always passes PasswordPolicy by construction (see generateTemporaryPassword's doc comment),
    // but validated anyway so a future change to either can never silently issue a
    // policy-violating password.
    const violations = PasswordPolicy.validate(temporaryPassword);
    /* istanbul ignore next -- defensive only, unreachable under the current generator/policy */
    if (violations.length > 0) throw new Error('Generated temporary password failed policy validation');

    const passwordHash = await passwordHasher.hash(temporaryPassword);
    const updated = await portalAccountRepository.update(account.id, {
      passwordHash,
      mustChangePassword: true,
      // A PENDING_VERIFICATION account is exactly the "locked out, never finished setup" case this
      // action exists for - same reasoning as RequestPasswordResetUseCase/ConfirmPasswordResetUseCase's
      // 2026-08-12 fix: staff issuing a password here is itself the identity check, so there's no
      // reason to leave it stuck unverified. ACTIVE accounts are left as-is.
      ...(account.status === 'PENDING_VERIFICATION' ? { status: 'ACTIVE' as const, emailVerifiedAt: new Date() } : {}),
    });

    if (profileActivityLogService) {
      await profileActivityLogService.logActivity({
        profileType: 'BORROWER',
        profileId: borrower.id,
        userId: staffUserId,
        action: 'portal_account_password_reset_by_staff',
        details: { portalAccountId: updated.id, email: updated.email },
      });
    }

    return { portalAccountId: updated.id, email: updated.email, temporaryPassword };
  }
}
