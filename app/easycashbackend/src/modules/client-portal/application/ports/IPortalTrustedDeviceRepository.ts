export interface PortalTrustedDeviceRecord {
  id: string;
  portalAccountId: string;
  expiresAt: Date;
}

export interface PortalTrustedDeviceSummary {
  id: string;
  createdAt: Date;
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
  /** 2026-07-31 (user request) - "session security visibility" on the Security tab: lists every
   * still-valid remembered device for the account, newest first. No user-agent/device-name is
   * captured today, so callers show creation/expiry dates only - never a fabricated device label. */
  listValidByAccount(portalAccountId: string): Promise<PortalTrustedDeviceSummary[]>;
  /** No-op if `id` doesn't belong to `portalAccountId` - the controller never leaks whether a
   * given id exists at all, matching every other portal self-service mutation's ownership check. */
  revoke(id: string, portalAccountId: string): Promise<void>;
}
