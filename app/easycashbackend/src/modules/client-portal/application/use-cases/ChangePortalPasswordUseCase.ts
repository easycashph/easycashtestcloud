import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { IPasswordHasher } from '@modules/identity/application/ports/IPasswordHasher';
import { PasswordPolicy } from '@modules/identity/domain/PasswordPolicy';
import { PortalAccountNotFoundError, PortalInvalidCredentialsError, PortalWeakPasswordError } from '../../domain/errors/PortalAuthErrors';

export interface ChangePortalPasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePortalPasswordUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  passwordHasher: IPasswordHasher;
}

/** Portal Security tab (2026-07-27 user request) - self-service password change, same
 * "requires current password" posture as identity's ChangeOwnPasswordUseCase, which this mirrors. */
export class ChangePortalPasswordUseCase {
  constructor(private readonly deps: ChangePortalPasswordUseCaseDeps) {}

  async execute(portalAccountId: string, input: ChangePortalPasswordInput): Promise<void> {
    const { portalAccountRepository, passwordHasher } = this.deps;

    const existing = await portalAccountRepository.findById(portalAccountId);
    if (!existing) throw new PortalAccountNotFoundError();

    const matches = await passwordHasher.compare(input.currentPassword, existing.passwordHash);
    if (!matches) throw new PortalInvalidCredentialsError();

    const violations = PasswordPolicy.validate(input.newPassword);
    if (violations.length > 0) throw new PortalWeakPasswordError(violations);

    const passwordHash = await passwordHasher.hash(input.newPassword);
    // 2026-08-06 (Bind existing Client data to Portal): clears the forced-change flag whenever it
    // was set (self-service password changes are a no-op here since it's already false) - this is
    // the only way a staff-issued temp-password account becomes fully usable.
    await portalAccountRepository.update(portalAccountId, { passwordHash, mustChangePassword: false });
  }
}
