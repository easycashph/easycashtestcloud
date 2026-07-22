import type { ReminderSettings } from '../../../application/ports/IReminderSettingsRepository';

export interface ReminderSettingsResponse {
  smsEnabled: boolean;
  emailEnabled: boolean;
  signingSmsEnabled: boolean;
  updatedAt: string;
  updatedByUserId: string | null;
}

export function presentReminderSettings(settings: ReminderSettings): ReminderSettingsResponse {
  return {
    smsEnabled: settings.smsEnabled,
    emailEnabled: settings.emailEnabled,
    signingSmsEnabled: settings.signingSmsEnabled,
    updatedAt: settings.updatedAt.toISOString(),
    updatedByUserId: settings.updatedByUserId,
  };
}
