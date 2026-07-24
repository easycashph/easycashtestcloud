import { NotFoundError } from '@shared/errors/DomainError';
import type { Borrower } from '@modules/borrower/domain/Borrower';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import { PortalAccountNotLinkedError } from '../../domain/errors/PortalAuthErrors';

/**
 * Phase D (2026-07-24 user request): reads the client's own profile straight off the real
 * `Borrower` record the LMS itself uses (linked via `PortalAccount.borrowerId`, set at "Create
 * Client Profile" time - see CreateBorrowerUseCase). Not a separate copy, so LMS and portal are
 * always in sync by construction, no reconciliation needed.
 */
export class GetPortalProfileUseCase {
  constructor(private readonly deps: { portalAccountRepository: IPortalAccountRepository; borrowerRepository: IBorrowerRepository }) {}

  async execute(portalAccountId: string): Promise<Borrower> {
    const account = await this.deps.portalAccountRepository.findById(portalAccountId);
    if (!account) {
      throw new NotFoundError('PortalAccount', portalAccountId);
    }
    if (!account.borrowerId) {
      throw new PortalAccountNotLinkedError();
    }

    const borrower = await this.deps.borrowerRepository.findById(account.borrowerId);
    if (!borrower) {
      throw new NotFoundError('Borrower', account.borrowerId);
    }

    return borrower;
  }
}
