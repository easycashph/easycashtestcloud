export type PortalChallengePurpose = 'SIGNUP' | 'PASSWORD_RESET' | 'LOGIN' | 'ENABLE_2FA';
export type PortalChallengeChannel = 'EMAIL' | 'SMS';

export interface PortalAccountChallengeRecord {
  id: string;
  portalAccountId: string;
  purpose: PortalChallengePurpose;
  channel: PortalChallengeChannel;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
}

export interface CreatePortalAccountChallengeInput {
  portalAccountId: string;
  purpose: PortalChallengePurpose;
  channel: PortalChallengeChannel;
  expiresAt: Date;
}

export interface CreatedPortalAccountChallenge {
  id: string;
  /** Plaintext 6-digit code - only ever available at creation time. */
  code: string;
}

/** Same opaque-secret shape as identity's ITwoFactorChallengeRepository - see that port's doc
 * comment for the reasoning (verifyAndConsume is a single atomic conditional update). */
export interface IPortalAccountChallengeRepository {
  create(input: CreatePortalAccountChallengeInput): Promise<CreatedPortalAccountChallenge>;
  findById(id: string): Promise<PortalAccountChallengeRecord | null>;
  verifyAndConsume(id: string, code: string): Promise<boolean>;
  incrementAttempts(id: string): Promise<number>;
  /** Marks a challenge consumed WITHOUT verifying a code - used to invalidate a superseded
   * challenge (2026-07-30: ResendPortalLoginOtpUseCase, so the old code stops working the moment a
   * new one is issued, not just whenever its own 5-minute window happens to lapse). A no-op if
   * already consumed. */
  invalidate(id: string): Promise<void>;
}
