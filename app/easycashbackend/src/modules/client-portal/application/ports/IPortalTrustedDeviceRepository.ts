export interface PortalTrustedDeviceRecord {
  id: string;
  portalAccountId: string;
  expiresAt: Date;
}

export interface IssuePortalTrustedDeviceInput {
  portalAccountId: string;
  expiresAt: Date;
}

export interface IssuedPortalTrustedDevice {
  id: string;
  /** Plaintext token - only ever available at issuance time; never stored. */
  rawToken: string;
}

/** "Remember this device" (2026-07-30 user request) - Portal's own version of
 * identity's ITrustedDeviceRepository, same shape/reasoning. */
export interface IPortalTrustedDeviceRepository {
  issue(input: IssuePortalTrustedDeviceInput): Promise<IssuedPortalTrustedDevice>;
  findValidByRawToken(rawToken: string): Promise<PortalTrustedDeviceRecord | null>;
}
