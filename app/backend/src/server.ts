import { createApp } from './app';
import { env } from '@shared/config/env';
import { logger } from '@shared/logger/logger';
import { startSmsReminderScheduler } from '@modules/sms-reminder/infrastructure/smsReminderScheduler';
import { SendPaymentReminderSmsUseCase } from '@modules/sms-reminder/application/use-cases/SendPaymentReminderSmsUseCase';
import { PrismaSmsReminderRepository } from '@modules/sms-reminder/infrastructure/PrismaSmsReminderRepository';
import { M360SmsGateway } from '@modules/sms-reminder/infrastructure/M360SmsGateway';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`easycash-backend listening on port ${env.PORT} (${env.NODE_ENV})`);
});

// Not started inside createApp() - see startSmsReminderScheduler's own doc comment (tests import
// createApp() directly and must never spin up a real cron timer).
startSmsReminderScheduler({
  sendPaymentReminderSmsUseCase: new SendPaymentReminderSmsUseCase({
    smsReminderRepository: new PrismaSmsReminderRepository(),
    smsGateway: new M360SmsGateway({
      apiUrl: env.M360_API_URL,
      username: env.M360_USERNAME ?? '',
      password: env.M360_PASSWORD ?? '',
      shortcodeMask: env.M360_SHORTCODE_MASK ?? '',
    }),
    smsEnabled: env.SMS_ENABLED,
    messageTemplate: env.SMS_REMINDER_TEMPLATE,
  }),
  cronExpression: env.SMS_REMINDER_CRON,
  daysBeforeDue: env.SMS_REMINDER_DAYS_BEFORE_DUE,
});

function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully.`);
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
