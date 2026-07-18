import cron from 'node-cron';
import { logger } from '@shared/logger/logger';
import type { SendPaymentReminderEmailUseCase } from '../application/use-cases/SendPaymentReminderEmailUseCase';

/** Mirrors smsReminderScheduler.ts exactly - see that file's doc comment for why this is started
 * from src/server.ts, never from createApp(). */
export function startEmailReminderScheduler(deps: { sendPaymentReminderEmailUseCase: SendPaymentReminderEmailUseCase; cronExpression: string }): void {
  cron.schedule(
    deps.cronExpression,
    () => {
      deps.sendPaymentReminderEmailUseCase
        .execute(new Date())
        .then((result) => logger.info(result, 'Payment reminder email job finished'))
        .catch((error) => logger.error({ error }, 'Payment reminder email job crashed'));
    },
    { timezone: 'Asia/Manila' },
  );
}
