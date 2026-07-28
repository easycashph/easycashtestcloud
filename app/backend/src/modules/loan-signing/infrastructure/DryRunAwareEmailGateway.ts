import { logger } from '@shared/logger/logger';
import type { IEmailGateway } from '@modules/email-reminder/application/ports/IEmailGateway';
import type { IReminderSettingsRepository } from '@modules/reminder-settings/application/ports/IReminderSettingsRepository';

/** 2026-07-28 - mirrors `DryRunAwareSmsGateway`'s own doc comment exactly, for the e-signature
 * signing-link EMAIL channel: wraps a real `IEmailGateway` so every `send()` checks the DB-backed
 * `ReminderSettings.signingEmailEnabled` switch first, checked fresh on every call (not cached at
 * boot) so a mid-day MIS toggle in the System tab takes effect immediately. Deliberately a SEPARATE
 * flag from `signingSmsEnabled` and from `emailEnabled` (payment reminders) - added as an
 * alternative delivery channel after confirming some Smart-network numbers silently filter/drop
 * link-containing SMS. */
export class DryRunAwareEmailGateway implements IEmailGateway {
  constructor(
    private readonly real: IEmailGateway,
    private readonly reminderSettingsRepository: IReminderSettingsRepository,
  ) {}

  async send(to: string, subject: string, body: string, html?: string): Promise<void> {
    const settings = await this.reminderSettingsRepository.get();
    if (!settings.signingEmailEnabled) {
      logger.info({ to, subject, body }, '[DRY RUN] signingEmailEnabled=false - would have sent this email, no real message was sent.');
      return;
    }
    await this.real.send(to, subject, body, html);
  }
}
