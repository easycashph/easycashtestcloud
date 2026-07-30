import { logger } from '@shared/logger/logger';
import type { IEmailGateway } from '@modules/email-reminder/application/ports/IEmailGateway';
import type { ISmsGateway } from '@modules/sms-reminder/application/ports/ISmsGateway';
import type { IOtpSender } from '../application/ports/IOtpSender';
import type { TwoFactorChannel } from '../application/ports/ITwoFactorChallengeRepository';

/**
 * Wraps the same email/SMS gateways the Payment Reminders feature already uses, gated by the same
 * SMS_ENABLED/EMAIL_ENABLED dry-run env flags (2026-07-18 pattern) - safe to leave 2FA turned on
 * for any account in every environment: with the flags off (the default, and true today - no real
 * M360/SMTP credentials are configured in this environment yet), no real SMS/email ever goes out.
 * The code is logged instead, purely so 2FA can be exercised end-to-end before real credentials
 * exist - never done when the corresponding flag is actually on.
 */
export class OtpSender implements IOtpSender {
  constructor(
    private readonly config: {
      smsGateway: ISmsGateway;
      emailGateway: IEmailGateway;
      smsEnabled: boolean;
      emailEnabled: boolean;
    },
  ) {}

  async send(channel: TwoFactorChannel, destination: string, code: string): Promise<void> {
    const message = `Your Easycash verification code is ${code}. It expires in 5 minutes. Never share this code with anyone.`;

    if (channel === 'SMS') {
      if (!this.config.smsEnabled) {
        logger.info({ destination, code }, 'DRY-RUN: OTP SMS not actually sent (SMS_ENABLED=false)');
        return;
      }
      await this.config.smsGateway.send(destination, message);
      return;
    }

    if (!this.config.emailEnabled) {
      logger.info({ destination, code }, 'DRY-RUN: OTP email not actually sent (EMAIL_ENABLED=false)');
      return;
    }
    await this.config.emailGateway.send(destination, 'Your Easycash verification code', message);
  }
}
