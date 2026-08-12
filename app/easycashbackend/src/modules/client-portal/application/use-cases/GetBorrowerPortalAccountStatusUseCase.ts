import type { IPortalAccountRepository, PortalAccountRecord } from '../ports/IPortalAccountRepository';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import { NotFoundError } from '@shared/errors/DomainError';

export interface PortalAccountSummary {
  id: string;
  email: string;
  status: PortalAccountRecord['status'];
  mustChangePassword: boolean;
  createdAt: string;
}

export interface BorrowerPortalAccountStatus {
  /** A PortalAccount already linked (`borrowerId`) to this Borrower, if any. */
  linked: PortalAccountSummary | null;
  /** An UNLINKED PortalAccount matching this Borrower's email - offer "Bind Existing Portal
   * Account" instead of "Create Portal Account" when this is present. Always null if `linked`. */
  unlinkedMatchByEmail: PortalAccountSummary | null;
}

function summarize(account: PortalAccountRecord): PortalAccountSummary {
  return { id: account.id, email: account.email, status: account.status, mustChangePassword: account.mustChangePassword, createdAt: account.createdAt.toISOString() };
}

export interface GetBorrowerPortalAccountStatusUseCaseDeps {
  borrowerRepository: IBorrowerRepository;
  portalAccountRepository: IPortalAccountRepository;
}

/** Backs the Client Profile page's "Portal Account" panel (2026-08-06) - tells the UI which of
 * Create / Bind / read-only-status to show, without the frontend needing to know the matching
 * rules itself. */
export class GetBorrowerPortalAccountStatusUseCase {
  constructor(private readonly deps: GetBorrowerPortalAccountStatusUseCaseDeps) {}

  async execute(borrowerId: string): Promise<BorrowerPortalAccountStatus> {
    const { borrowerRepository, portalAccountRepository } = this.deps;

    const borrower = await borrowerRepository.findById(borrowerId);
    if (!borrower) throw new NotFoundError('Borrower', borrowerId);

    const linked = await portalAccountRepository.findByBorrowerId(borrowerId);
    if (linked) return { linked: summarize(linked), unlinkedMatchByEmail: null };

    if (!borrower.email) return { linked: null, unlinkedMatchByEmail: null };

    const byEmail = await portalAccountRepository.findByEmail(borrower.email);
    const unlinkedMatchByEmail = byEmail && !byEmail.borrowerId ? summarize(byEmail) : null;
    return { linked: null, unlinkedMatchByEmail };
  }
}
