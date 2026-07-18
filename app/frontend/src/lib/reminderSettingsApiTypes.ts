/** Mirrors `app/backend`'s `ReminderSettingsPresenter.presentReminderSettings()` JSON shape
 * exactly - MIS-only master switches for the SMS/Email daily cron jobs (2026-07-18 user request).
 * DB-backed (not the static `.env` `SMS_ENABLED`/`EMAIL_ENABLED`, which remain fallback defaults
 * only), so a toggle here takes effect on the next cron run without a server restart. */
export interface ReminderSettings {
  smsEnabled: boolean;
  emailEnabled: boolean;
  updatedAt: string;
  updatedByUserId: string | null;
}
