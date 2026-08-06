import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { PortalChallengeChannel } from '../ports/IPortalAccountChallengeRepository';
import type { PortalAuthenticatedAccountView } from '../dtos/PortalAuthDtos';
import { PortalAccountNotFoundError } from '../../domain/errors/PortalAuthErrors';

export interface GetPortalAccountUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
}

/** Backs `GET /portal/me` - re-fetches from the database rather than trusting the decoded token
 * claims alone (same reasoning as identity's GetCurrentUserUseCase), and returns the full account
 * view (including `borrowerId`) so the portal frontend's dashboard doesn't need a second call. */
export class GetPortalAccountUseCase {
  constructor(private readonly deps: GetPortalAccountUseCaseDeps) {}

  async execute(accountId: string): Promise<PortalAuthenticatedAccountView> {
    const account = await this.deps.portalAccountRepository.findById(accountId);
    if (!account) throw new PortalAccountNotFoundError();
    return {
      id: account.id,
      email: account.email,
      contactNumber: account.contactNumber,
      borrowerId: account.borrowerId,
      twoFactorEnabled: account.twoFactorEnabled,
      twoFactorChannel: account.twoFactorChannel as PortalChallengeChannel | null,
      mustChangePassword: account.mustChangePassword,
    };
  }
}
