import { logger } from '@shared/logger/logger';
import type { IEmailGateway } from '@modules/email-reminder/application/ports/IEmailGateway';
import type { ISmsGateway } from '@modules/sms-reminder/application/ports/ISmsGateway';
import type { IReminderSettingsRepository } from '@modules/reminder-settings/application/ports/IReminderSettingsRepository';
import { PortalNotification, type PortalNotificationType } from '../domain/PortalNotification';
import type { IPortalAccountRepository } from './ports/IPortalAccountRepository';
import type { IPortalNotificationRepository } from './ports/IPortalNotificationRepository';

export interface NotifyPortalAccountInput {
  portalAccountId: string;
  type: PortalNotificationType;
  title: string;
  /** Longer-form copy for the email/SMS body and the bell dropdown - falls back to `title` if omitted. */
  body?: string;
  entityType?: string;
  entityId?: string;
}

/**
 * Easycash Portal Notification Center (2026-07-24 user request) - always writes the in-app bell
 * notification; additionally sends email/SMS, each independently gated by the same MIS-toggleable
 * portalEmailEnabled/portalSmsEnabled switches PortalOtpSender uses (Settings > System >
 * Reminders), read fresh on every call so a toggle flip takes effect without a restart. Deliberately
 * NOT the same instance/flags as staff notifications or payment reminders - see PortalOtpSender's
 * own doc comment for why these auth/notification realms never share delivery settings.
 *
 * Called as an optional side-effect dep from ApproveLoanApplicationUseCase/
 * DeclineLoanApplicationUseCase, same pattern as NotificationService's use in those same use
 * cases for staff notifications - only fires when `application.portalAccountId` is set (a
 * portal-submitted application), silently skipped for a staff-encoded/walk-in one.
 */
export class PortalNotificationService {
  constructor(
    private readonly deps: {
      portalNotificationRepository: IPortalNotificationRepository;
      portalAccountRepository: IPortalAccountRepository;
      reminderSettingsRepository: IReminderSettingsRepository;
      emailGateway: IEmailGateway;
      smsGateway: ISmsGateway;
    },
  ) {}

  async notify(input: NotifyPortalAccountInput): Promise<void> {
    const body = input.body ?? input.title;

    await this.deps.portalNotificationRepository.create(
      PortalNotification.create({
        portalAccountId: input.portalAccountId,
        type: input.type,
        title: input.title,
        body,
        entityType: input.entityType,
        entityId: input.entityId,
      }),
    );

    const [account, settings] = await Promise.all([
      this.deps.portalAccountRepository.findById(input.portalAccountId),
      this.deps.reminderSettingsRepository.get(),
    ]);
    if (!account) return;

    if (settings.portalEmailEnabled) {
      await this.deps.emailGateway.send(account.email, input.title, body);
    } else {
      logger.info({ destination: account.email, title: input.title }, 'DRY-RUN: Portal notification email not actually sent (portalEmailEnabled=false)');
    }

    if (settings.portalSmsEnabled && account.contactNumber) {
      await this.deps.smsGateway.send(account.contactNumber, `${input.title} - ${body}`);
    } else if (settings.portalSmsEnabled) {
      logger.info({ portalAccountId: account.id, title: input.title }, 'DRY-RUN: Portal notification SMS not sent - no contact number on file');
    } else {
      logger.info({ title: input.title }, 'DRY-RUN: Portal notification SMS not actually sent (portalSmsEnabled=false)');
    }
  }
}
