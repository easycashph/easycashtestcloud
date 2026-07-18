import type { ReminderSettings } from '../../../application/ports/IReminderSettingsRepository';

export interface ReminderSettingsResponse {
  smsEnabled: boolean;
  emailEnabled: boolean;
  updatedAt: string;
  updatedByUserId: string | null;
}

export function presentReminderSettings(settings: ReminderSettings): ReminderSettingsResponse {
  return {
    smsEnabled: settings.smsEnabled,
    emailEnabled: settings.emailEnabled,
    updatedAt: settings.updatedAt.toISOString(),
    updatedByUserId: settings.updatedByUserId,
  };
}
