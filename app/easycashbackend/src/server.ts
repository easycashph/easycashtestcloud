import { createApp } from './app';
import { env } from '@shared/config/env';
import { logger } from '@shared/logger/logger';
import { startSmsReminderScheduler } from '@modules/sms-reminder/infrastructure/smsReminderScheduler';
import { SendPaymentReminderSmsUseCase } from '@modules/sms-reminder/application/use-cases/SendPaymentReminderSmsUseCase';
import { PrismaSmsReminderRepository } from '@modules/sms-reminder/infrastructure/PrismaSmsReminderRepository';
import { M360SmsGateway } from '@modules/sms-reminder/infrastructure/M360SmsGateway';
import { startEmailReminderScheduler } from '@modules/email-reminder/infrastructure/emailReminderScheduler';
import { SendPaymentReminderEmailUseCase } from '@modules/email-reminder/application/use-cases/SendPaymentReminderEmailUseCase';
import { PrismaEmailReminderRepository } from '@modules/email-reminder/infrastructure/PrismaEmailReminderRepository';
import { NodemailerEmailGateway } from '@modules/email-reminder/infrastructure/NodemailerEmailGateway';
import { PrismaReminderSettingsRepository } from '@modules/reminder-settings/infrastructure/PrismaReminderSettingsRepository';
import { startOverdueNotificationScheduler } from '@modules/notification/infrastructure/OverdueNotificationScheduler';
import type { NotificationService } from '@modules/notification/application/NotificationService';
import { startFinanceNewsScheduler } from '@modules/finance-news/infrastructure/financeNewsScheduler';
import { FetchExternalFinanceNewsUseCase, RssParserAdapter, type FeedSource } from '@modules/finance-news/application/use-cases/FetchExternalFinanceNewsUseCase';
import { PrismaExternalNewsLinkRepository } from '@modules/finance-news/infrastructure/PrismaExternalNewsLinkRepository';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`easycash-backend listening on port ${env.PORT} (${env.NODE_ENV})`);
});

// Not started inside createApp() - see startSmsReminderScheduler's own doc comment (tests import
// createApp() directly and must never spin up a real cron timer).
const reminderSettingsRepository = new PrismaReminderSettingsRepository();

startSmsReminderScheduler({
  sendPaymentReminderSmsUseCase: new SendPaymentReminderSmsUseCase({
    smsReminderRepository: new PrismaSmsReminderRepository(),
    smsGateway: new M360SmsGateway({
      apiUrl: env.M360_API_URL,
      username: env.M360_USERNAME ?? '',
      password: env.M360_PASSWORD ?? '',
      shortcodeMask: env.M360_SHORTCODE_MASK ?? '',
    }),
    reminderSettingsRepository,
  }),
  cronExpression: env.SMS_REMINDER_CRON,
});

startEmailReminderScheduler({
  sendPaymentReminderEmailUseCase: new SendPaymentReminderEmailUseCase({
    emailReminderRepository: new PrismaEmailReminderRepository(),
    emailGateway: new NodemailerEmailGateway({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      username: env.SMTP_USERNAME ?? '',
      password: env.SMTP_PASSWORD ?? '',
      fromAddress: env.SMTP_FROM_ADDRESS,
    }),
    reminderSettingsRepository,
  }),
  cronExpression: env.EMAIL_REMINDER_CRON,
});

const stopOverdueNotificationScheduler = startOverdueNotificationScheduler(
  app.locals.notificationService as NotificationService,
);

// Automated PH Lending/Finance News + Road/Weather Advisory feed (2026-08-06 user request) - see
// financeNewsScheduler.ts's own doc comment. Feed URLs are comma-separated env vars; a category
// with no configured feeds is simply skipped (empty list), so this is a no-op until an operator
// sets at least one real, reachable feed URL.
function parseFeedUrls(commaSeparated: string, category: 'FINANCE' | 'ADVISORY'): FeedSource[] {
  return commaSeparated
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
    .map((url) => ({ url, category }));
}

startFinanceNewsScheduler({
  fetchExternalFinanceNewsUseCase: new FetchExternalFinanceNewsUseCase({
    externalNewsLinkRepository: new PrismaExternalNewsLinkRepository(),
    rssFeedParser: new RssParserAdapter(),
  }),
  feeds: [...parseFeedUrls(env.FINANCE_NEWS_FEED_URLS, 'FINANCE'), ...parseFeedUrls(env.ADVISORY_NEWS_FEED_URLS, 'ADVISORY')],
  cronExpression: env.FINANCE_NEWS_FETCH_CRON,
});

function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully.`);
  stopOverdueNotificationScheduler();
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
