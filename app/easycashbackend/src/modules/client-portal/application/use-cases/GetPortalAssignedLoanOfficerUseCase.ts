import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';

export interface PortalAssignedLoanOfficer {
  /** First name only, deliberately (2026-08-06 user request/privacy decision) - never the staff
   * member's last name or any other identifying detail, to a client. */
  firstName: string;
}

export interface GetPortalAssignedLoanOfficerUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  borrowerRepository: IBorrowerRepository;
  userRepository: IUserRepository;
}

/**
 * "Chat with your loan officer" dashboard card (2026-08-06 user request) - returns `null`
 * (not an error) whenever there's nothing specific to show: no linked Borrower, no assigned loan
 * officer, or the assigned officer is no longer `ACTIVE` staff. The frontend falls back to a
 * generic "a loan officer will respond via chat" message in every `null` case - there is no
 * "designated loan officer" guarantee for every client, by design (2026-08-06 user decision).
 */
export class GetPortalAssignedLoanOfficerUseCase {
  constructor(private readonly deps: GetPortalAssignedLoanOfficerUseCaseDeps) {}

  async execute(portalAccountId: string): Promise<PortalAssignedLoanOfficer | null> {
    const { portalAccountRepository, borrowerRepository, userRepository } = this.deps;

    const account = await portalAccountRepository.findById(portalAccountId);
    if (!account?.borrowerId) return null;

    const borrower = await borrowerRepository.findById(account.borrowerId);
    if (!borrower?.assignedLoanOfficerId) return null;

    const loanOfficer = await userRepository.findById(borrower.assignedLoanOfficerId);
    if (!loanOfficer || loanOfficer.status !== 'ACTIVE') return null;

    return { firstName: loanOfficer.firstName };
  }
}
