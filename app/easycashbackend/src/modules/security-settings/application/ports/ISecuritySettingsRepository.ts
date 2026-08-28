export interface SecuritySettings {
  /** "Require 2FA for all users" (2026-08-28) - see the Prisma model's own doc comment for the
   * full enforcement/safety reasoning. */
  enforceTwoFactorForAllUsers: boolean;
  updatedAt: Date;
  updatedByUserId: string | null;
}

export interface UpdateSecuritySettingsInput {
  enforceTwoFactorForAllUsers?: boolean;
  updatedByUserId: string;
}

export interface ISecuritySettingsRepository {
  /** Creates the singleton row (enforcement off) on first call if it doesn't exist yet. */
  get(): Promise<SecuritySettings>;
  update(input: UpdateSecuritySettingsInput): Promise<SecuritySettings>;
}
