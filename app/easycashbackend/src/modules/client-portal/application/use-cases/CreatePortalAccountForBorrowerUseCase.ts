import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { IPasswordHasher } from '@modules/identity/application/ports/IPasswordHasher';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import { NotFoundError } from '@shared/errors/DomainError';
import { BorrowerMissingEmailError, BorrowerPortalAccountAlreadyLinkedError } from '@modules/borrower/domain/errors/BorrowerDomainErrors';
import { PortalEmailAlreadyInUseError } from '../../domain/errors/PortalAuthErrors';

/** 2026-08-06 (Bind existing Client data to Portal, explicit user decision): a single, identical
 * temp password issued for every staff-created account. This is a real security trade-off (anyone
 * who knows a client's email could otherwise log in as them) - it is safe ONLY because
 * `mustChangePassword: true` below blocks access to everything else in the portal until the client
 * sets their own password (see PortalLoginUseCase's `mustChangePassword` field and the portal
 * frontend's forced change-password gate). Do not remove that flag without also removing the
 * shared-password approach itself. */
export const STAFF_ISSUED_TEMP_PASSWORD = 'easycashportal123';

export interface CreatePortalAccountForBorrowerUseCaseDeps {
  borrowerRepository: IBorrowerRepository;
  portalAccountRepository: IPortalAccountRepository;
  passwordHasher: IPasswordHasher;
  profileActivityLogService?: ProfileActivityLogService;
}

export interface CreatePortalAccountForBorrowerOutput {
  portalAccountId: string;
  email: string;
  temporaryPassword: string;
}

/** Staff-facing "Create Portal Account" action (Client Profile page, MIS-only) - for clients who
 * won't self-signup. Skips email verification (staff already know who they're looking at) and
 * issues the account ACTIVE + already linked to this Borrower, but gated behind
 * `mustChangePassword` until the client sets a real password of their own. */
export class CreatePortalAccountForBorrowerUseCase {
  constructor(private readonly deps: CreatePortalAccountForBorrowerUseCaseDeps) {}

  async execute(borrowerId: string, staffUserId: string): Promise<CreatePortalAccountForBorrowerOutput> {
    const { borrowerRepository, portalAccountRepository, passwordHasher, profileActivityLogService } = this.deps;

    const borrower = await borrowerRepository.findById(borrowerId);
    if (!borrower) throw new NotFoundError('Borrower', borrowerId);
    if (!borrower.email) throw new BorrowerMissingEmailError(borrowerId);

    const alreadyLinked = await portalAccountRepository.findByBorrowerId(borrowerId);
    if (alreadyLinked) throw new BorrowerPortalAccountAlreadyLinkedError(borrowerId);

    const existingByEmail = await portalAccountRepository.findByEmail(borrower.email);
    if (existingByEmail) throw new PortalEmailAlreadyInUseError();

    const passwordHash = await passwordHasher.hash(STAFF_ISSUED_TEMP_PASSWORD);
    const created = await portalAccountRepository.create({
      email: borrower.email,
      passwordHash,
      status: 'ACTIVE',
      borrowerId: borrower.id,
      mustChangePassword: true,
    });

    if (profileActivityLogService) {
      await profileActivityLogService.logActivity({
        profileType: 'BORROWER',
        profileId: borrower.id,
        userId: staffUserId,
        action: 'portal_account_created_by_staff',
        details: { portalAccountId: created.id, email: created.email },
      });
    }

    return { portalAccountId: created.id, email: created.email, temporaryPassword: STAFF_ISSUED_TEMP_PASSWORD };
  }
}
