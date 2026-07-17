import { createApp } from './app';
import { env } from '@shared/config/env';
import { logger } from '@shared/logger/logger';
import { startOverdueNotificationScheduler } from '@modules/notification/infrastructure/OverdueNotificationScheduler';
import type { NotificationService } from '@modules/notification/application/NotificationService';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`easycash-backend listening on port ${env.PORT} (${env.NODE_ENV})`);
});

const stopOverdueNotificationScheduler = startOverdueNotificationScheduler(
  app.locals.notificationService as NotificationService,
);

function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully.`);
  stopOverdueNotificationScheduler();
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
