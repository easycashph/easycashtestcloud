export type TwoFactorPurpose = 'LOGIN' | 'ENABLE';
export type TwoFactorChannel = 'EMAIL' | 'SMS';

export interface TwoFactorChallengeRecord {
  id: string;
  userId: string;
  purpose: TwoFactorPurpose;
  channel: TwoFactorChannel;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
}

export interface CreateTwoFactorChallengeInput {
  userId: string;
  purpose: TwoFactorPurpose;
  channel: TwoFactorChannel;
  expiresAt: Date;
}

export interface CreatedTwoFactorChallenge {
  id: string;
  /** Plaintext 6-digit code — only ever available at creation time; never stored (see
   * TwoFactorChallenge.codeHash's doc comment in schema.prisma). The caller sends this via the
   * chosen channel's gateway, then discards it. */
  code: string;
}

/**
 * Settings > Security > Two-Factor Authentication (2026-07-22). Same opaque-secret-never-stored
 * shape as `IRefreshTokenRepository` (issue → raw value returned once, verify → only the hash is
 * ever compared) - see that port's own doc comment for the reasoning.
 */
export interface ITwoFactorChallengeRepository {
  create(input: CreateTwoFactorChallengeInput): Promise<CreatedTwoFactorChallenge>;
  findById(id: string): Promise<TwoFactorChallengeRecord | null>;
  /**
   * Single atomic conditional UPDATE (same C-01 pattern as RefreshTokenRepository.revoke): matches
   * only if `id` AND the hash of `code` both match, AND the row isn't already consumed or expired.
   * Returns true only if THIS call is the one that consumed it - a wrong code, an already-consumed
   * challenge, and an expired challenge all return false alike; the caller (VerifyLoginOtpUseCase /
   * ConfirmTwoFactorSetupUseCase) uses a separate `findById` read to tell those cases apart for the
   * error message, without reopening a race on the actual consume step.
   */
  verifyAndConsume(id: string, code: string): Promise<boolean>;
  /** Returns the attempt count AFTER incrementing. */
  incrementAttempts(id: string): Promise<number>;
}
