import { logger } from '@shared/logger/logger';
import type { IEmailGateway } from '@modules/email-reminder/application/ports/IEmailGateway';
import type { ISmsGateway } from '@modules/sms-reminder/application/ports/ISmsGateway';
import type { IReminderSettingsRepository } from '@modules/reminder-settings/application/ports/IReminderSettingsRepository';
import type { IOtpSender } from '@modules/identity/application/ports/IOtpSender';
import type { TwoFactorChannel } from '@modules/identity/application/ports/ITwoFactorChallengeRepository';

/**
 * Easycash Portal's own OTP sender (signup verification, password reset) - deliberately NOT the
 * same instance/flags as identity's OtpSender (staff 2FA), which is gated by the static
 * SMS_ENABLED/EMAIL_ENABLED env vars set once at process startup. This one is gated by the MIS-
 * toggleable `portalEmailEnabled`/`portalSmsEnabled` switches on the ReminderSettings singleton
 * row (Settings > System > Reminders), read fresh on every send (same "no restart needed" pattern
 * as DryRunAwareSmsGateway) - so MIS can turn on real portal OTP delivery without touching staff
 * 2FA delivery, and vice versa. See schema.prisma's doc comment on these two fields.
 */
export class PortalOtpSender implements IOtpSender {
  constructor(
    private readonly config: {
      smsGateway: ISmsGateway;
      emailGateway: IEmailGateway;
      reminderSettingsRepository: IReminderSettingsRepository;
    },
  ) {}

  async send(channel: TwoFactorChannel, destination: string, code: string): Promise<void> {
    const message = `Your Easycash Portal verification code is ${code}. It expires in 5 minutes. Never share this code with anyone.`;
    const settings = await this.config.reminderSettingsRepository.get();

    if (channel === 'SMS') {
      if (!settings.portalSmsEnabled) {
        logger.info({ destination, code }, 'DRY-RUN: Portal OTP SMS not actually sent (portalSmsEnabled=false)');
        return;
      }
      await this.config.smsGateway.send(destination, message);
      return;
    }

    if (!settings.portalEmailEnabled) {
      logger.info({ destination, code }, 'DRY-RUN: Portal OTP email not actually sent (portalEmailEnabled=false)');
      return;
    }
    await this.config.emailGateway.send(destination, 'Your Easycash Portal verification code', message);
  }
}
