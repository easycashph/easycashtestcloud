import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { IPasswordHasher } from '@modules/identity/application/ports/IPasswordHasher';
import { PortalAccountNotFoundError, PortalEmailAlreadyInUseError, PortalInvalidCredentialsError } from '../../domain/errors/PortalAuthErrors';

export interface ChangePortalEmailInput {
  newEmail: string;
  currentPassword: string;
}

export interface ChangePortalEmailUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  passwordHasher: IPasswordHasher;
}

/** Portal Security tab (2026-07-27 user request) - self-service login-email change, gated by the
 * current password (same posture as password change: confirms the person changing account
 * identity is the one currently signed in, not just holding a still-valid access token). Note this
 * changes the PortalAccount's login email only, not the linked Borrower's contact email (see
 * UpdatePortalProfileUseCase for that, once linked). */
export class ChangePortalEmailUseCase {
  constructor(private readonly deps: ChangePortalEmailUseCaseDeps) {}

  async execute(portalAccountId: string, input: ChangePortalEmailInput): Promise<void> {
    const { portalAccountRepository, passwordHasher } = this.deps;

    const existing = await portalAccountRepository.findById(portalAccountId);
    if (!existing) throw new PortalAccountNotFoundError();

    const matches = await passwordHasher.compare(input.currentPassword, existing.passwordHash);
    if (!matches) throw new PortalInvalidCredentialsError();

    const normalizedNewEmail = input.newEmail.toLowerCase().trim();
    if (normalizedNewEmail !== existing.email) {
      const conflict = await portalAccountRepository.findByEmail(normalizedNewEmail);
      if (conflict) throw new PortalEmailAlreadyInUseError();
    }

    await portalAccountRepository.update(portalAccountId, { email: normalizedNewEmail });
  }
}
