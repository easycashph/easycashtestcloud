import type { IPortalAccountRepository, PortalAccountRecord } from '../ports/IPortalAccountRepository';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import { ProfileActivityLogService } from '@modules/profile-activity/application/ProfileActivityLogService';
import { NotFoundError } from '@shared/errors/DomainError';
import { BorrowerMissingEmailError, BorrowerPortalAccountAlreadyLinkedError } from '@modules/borrower/domain/errors/BorrowerDomainErrors';
import { PortalAccountAlreadyLinkedError, PortalAccountNotFoundError } from '../../domain/errors/PortalAuthErrors';

export interface BindPortalAccountToBorrowerUseCaseDeps {
  borrowerRepository: IBorrowerRepository;
  portalAccountRepository: IPortalAccountRepository;
  profileActivityLogService?: ProfileActivityLogService;
}

/**
 * Staff-facing "Bind Existing Portal Account" action (Client Profile page, MIS-only) - for a
 * client who already signed up on the Portal (using their real client email) before this binding
 * feature existed. Unlike the automated signup/backfill paths, this is a deliberate, single-
 * Borrower staff action from a specific client's own profile page, so the 0/1/2+ ambiguity rule
 * that governs those automated paths (`matchBorrowerByEmail`) doesn't apply here - the Borrower is
 * already unambiguously chosen by which profile page staff is on.
 */
export class BindPortalAccountToBorrowerUseCase {
  constructor(private readonly deps: BindPortalAccountToBorrowerUseCaseDeps) {}

  async execute(borrowerId: string, staffUserId: string): Promise<PortalAccountRecord> {
    const { borrowerRepository, portalAccountRepository, profileActivityLogService } = this.deps;

    const borrower = await borrowerRepository.findById(borrowerId);
    if (!borrower) throw new NotFoundError('Borrower', borrowerId);
    if (!borrower.email) throw new BorrowerMissingEmailError(borrowerId);

    const alreadyLinked = await portalAccountRepository.findByBorrowerId(borrowerId);
    if (alreadyLinked) throw new BorrowerPortalAccountAlreadyLinkedError(borrowerId);

    const account = await portalAccountRepository.findByEmail(borrower.email);
    if (!account) throw new PortalAccountNotFoundError();
    if (account.borrowerId) throw new PortalAccountAlreadyLinkedError();

    const updated = await portalAccountRepository.update(account.id, { borrowerId: borrower.id });

    if (profileActivityLogService) {
      await profileActivityLogService.logActivity({
        profileType: 'BORROWER',
        profileId: borrower.id,
        userId: staffUserId,
        action: 'portal_account_bound_by_staff',
        details: { portalAccountId: updated.id, email: updated.email },
      });
    }

    return updated;
  }
}
