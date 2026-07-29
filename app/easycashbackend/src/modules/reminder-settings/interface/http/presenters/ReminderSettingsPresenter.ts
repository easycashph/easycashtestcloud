import type { ReminderSettings } from '../../../application/ports/IReminderSettingsRepository';

export interface ReminderSettingsResponse {
  smsEnabled: boolean;
  emailEnabled: boolean;
  signingSmsEnabled: boolean;
  signingEmailEnabled: boolean;
  portalEmailEnabled: boolean;
  portalSmsEnabled: boolean;
  updatedAt: string;
  updatedByUserId: string | null;
}

export function presentReminderSettings(settings: ReminderSettings): ReminderSettingsResponse {
  return {
    smsEnabled: settings.smsEnabled,
    emailEnabled: settings.emailEnabled,
    signingSmsEnabled: settings.signingSmsEnabled,
    signingEmailEnabled: settings.signingEmailEnabled,
    portalEmailEnabled: settings.portalEmailEnabled,
    portalSmsEnabled: settings.portalSmsEnabled,
    updatedAt: settings.updatedAt.toISOString(),
    updatedByUserId: settings.updatedByUserId,
  };
}
