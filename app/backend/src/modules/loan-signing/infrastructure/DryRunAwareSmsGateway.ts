import { logger } from '@shared/logger/logger';
import type { ISmsGateway, SmsSendResult } from '@modules/sms-reminder/application/ports/ISmsGateway';
import type { IReminderSettingsRepository } from '@modules/reminder-settings/application/ports/IReminderSettingsRepository';

/** 2026-07-22 - wraps a real `ISmsGateway` so every `send()` checks the DB-backed
 * `ReminderSettings.signingSmsEnabled` switch first, mirroring `SendPaymentReminderSmsUseCase`'s
 * own dry-run safety net (never sends a real SMS while disabled). Checked fresh on every call
 * (not cached at boot) so a mid-day MIS toggle in the System tab takes effect immediately,
 * matching the same precedent already established for `smsEnabled` (payment reminders).
 * Deliberately a SEPARATE flag from `smsEnabled` since that one also gates the reminders cron
 * affecting real clients - the user asked for e-signature SMS to be independently toggleable. */
export class DryRunAwareSmsGateway implements ISmsGateway {
  constructor(
    private readonly real: ISmsGateway,
    private readonly reminderSettingsRepository: IReminderSettingsRepository,
  ) {}

  async send(phoneNumber: string, message: string): Promise<SmsSendResult> {
    const settings = await this.reminderSettingsRepository.get();
    if (!settings.signingSmsEnabled) {
      logger.info(
        { phoneNumber, message },
        '[DRY RUN] signingSmsEnabled=false - would have sent this SMS, no real message was sent.',
      );
      return { providerTransId: `dry-run-${Date.now()}` };
    }
    return this.real.send(phoneNumber, message);
  }
}
