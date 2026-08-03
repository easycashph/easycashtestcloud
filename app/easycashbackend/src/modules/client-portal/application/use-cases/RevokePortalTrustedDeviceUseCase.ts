import type { IPortalTrustedDeviceRepository } from '../ports/IPortalTrustedDeviceRepository';

export interface RevokePortalTrustedDeviceUseCaseDeps {
  portalTrustedDeviceRepository: IPortalTrustedDeviceRepository;
}

/** Lets an applicant force a device to require 2FA again (lost/sold phone, shared computer, etc.)
 * without touching the account's password (2026-07-31 user request). */
export class RevokePortalTrustedDeviceUseCase {
  constructor(private readonly deps: RevokePortalTrustedDeviceUseCaseDeps) {}

  execute(id: string, portalAccountId: string): Promise<void> {
    return this.deps.portalTrustedDeviceRepository.revoke(id, portalAccountId);
  }
}
