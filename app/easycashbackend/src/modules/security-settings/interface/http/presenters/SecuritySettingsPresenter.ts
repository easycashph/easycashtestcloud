import type { SecuritySettings } from '../../../application/ports/ISecuritySettingsRepository';

export interface SecuritySettingsResponse {
  enforceTwoFactorForAllUsers: boolean;
  updatedAt: string;
  updatedByUserId: string | null;
}

export function presentSecuritySettings(settings: SecuritySettings): SecuritySettingsResponse {
  return {
    enforceTwoFactorForAllUsers: settings.enforceTwoFactorForAllUsers,
    updatedAt: settings.updatedAt.toISOString(),
    updatedByUserId: settings.updatedByUserId,
  };
}
