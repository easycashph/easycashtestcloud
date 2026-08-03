import type { IPortalTrustedDeviceRepository, PortalTrustedDeviceSummary } from '../ports/IPortalTrustedDeviceRepository';

export interface ListPortalTrustedDevicesUseCaseDeps {
  portalTrustedDeviceRepository: IPortalTrustedDeviceRepository;
}

/** Backs the Security tab's "trusted devices" list (2026-07-31 user request) - visibility into
 * which devices can currently skip the 2FA challenge on login. */
export class ListPortalTrustedDevicesUseCase {
  constructor(private readonly deps: ListPortalTrustedDevicesUseCaseDeps) {}

  execute(portalAccountId: string): Promise<PortalTrustedDeviceSummary[]> {
    return this.deps.portalTrustedDeviceRepository.listValidByAccount(portalAccountId);
  }
}
