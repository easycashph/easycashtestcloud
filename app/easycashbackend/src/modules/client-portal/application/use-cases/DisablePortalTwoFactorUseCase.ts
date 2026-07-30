import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { IPasswordHasher } from '@modules/identity/application/ports/IPasswordHasher';
import type { DisablePortalTwoFactorInput } from '../dtos/PortalAuthDtos';
import { PortalInvalidCredentialsError, PortalAccountNotFoundError } from '../../domain/errors/PortalAuthErrors';

export interface DisablePortalTwoFactorUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  passwordHasher: IPasswordHasher;
}

/** Portal Security > Two-Factor Authentication (2026-07-30) - the "get me unstuck" escape hatch:
 * requires the current password, deliberately no OTP - a client who can no longer receive codes on
 * their enabled channel (lost phone, changed email) must still be able to turn 2FA back off.
 * Mirrors identity's DisableTwoFactorUseCase exactly. */
export class DisablePortalTwoFactorUseCase {
  constructor(private readonly deps: DisablePortalTwoFactorUseCaseDeps) {}

  async execute(input: DisablePortalTwoFactorInput): Promise<void> {
    const account = await this.deps.portalAccountRepository.findById(input.portalAccountId);
    if (!account) throw new PortalAccountNotFoundError();

    const matches = await this.deps.passwordHasher.compare(input.currentPassword, account.passwordHash);
    if (!matches) throw new PortalInvalidCredentialsError();

    await this.deps.portalAccountRepository.update(input.portalAccountId, { twoFactorEnabled: false, twoFactorChannel: null });
  }
}
