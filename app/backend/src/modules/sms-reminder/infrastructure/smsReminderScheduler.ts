import cron from 'node-cron';
import { logger } from '@shared/logger/logger';
import type { SendPaymentReminderSmsUseCase } from '../application/use-cases/SendPaymentReminderSmsUseCase';

/**
 * The first genuinely timer-based background job in this codebase (see NotificationService's
 * `syncOverdueNotifications` doc comment - everything before this was a lazy per-request sync,
 * which doesn't work here since an SMS must fire once a day regardless of anyone opening the app).
 * Deliberately NOT started from `createApp()` (src/app.ts) - that function is also used by every
 * test file via supertest, and a real cron timer has no place running during a test suite. Call
 * this once, from src/server.ts, after the real process is listening.
 *
 * No `daysBeforeDue` parameter - the use case itself now checks every trigger in the 5-stage
 * schedule (5/3/1 days before, due date, and Monday past-due) each run, not a single configurable
 * offset.
 */
export function startSmsReminderScheduler(deps: { sendPaymentReminderSmsUseCase: SendPaymentReminderSmsUseCase; cronExpression: string }): void {
  cron.schedule(
    deps.cronExpression,
    () => {
      deps.sendPaymentReminderSmsUseCase
        .execute(new Date())
        .then((result) => logger.info(result, 'Payment reminder SMS job finished'))
        .catch((error) => logger.error({ error }, 'Payment reminder SMS job crashed'));
    },
    { timezone: 'Asia/Manila' },
  );
}
