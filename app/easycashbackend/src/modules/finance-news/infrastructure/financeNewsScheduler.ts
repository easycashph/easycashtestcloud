import cron from 'node-cron';
import { logger } from '@shared/logger/logger';
import type { FeedSource, FetchExternalFinanceNewsUseCase } from '../application/use-cases/FetchExternalFinanceNewsUseCase';

/** Same shape as `smsReminderScheduler.ts`/`emailReminderScheduler.ts` (2026-08-06 user request) -
 * deliberately NOT started from `createApp()` (src/app.ts), which the test suite also imports via
 * supertest; a real cron timer has no place running during tests. Call once from src/server.ts. */
export function startFinanceNewsScheduler(deps: {
  fetchExternalFinanceNewsUseCase: FetchExternalFinanceNewsUseCase;
  feeds: FeedSource[];
  cronExpression: string;
}): void {
  if (deps.feeds.length === 0) {
    logger.warn('Finance news scheduler not started - no feed URLs configured (FINANCE_NEWS_FEED_URLS / ADVISORY_NEWS_FEED_URLS)');
    return;
  }

  cron.schedule(
    deps.cronExpression,
    () => {
      deps.fetchExternalFinanceNewsUseCase
        .execute(deps.feeds)
        .then((result) => logger.info(result, 'Finance/advisory news fetch job finished'))
        .catch((error) => logger.error({ error }, 'Finance/advisory news fetch job crashed'));
    },
    { timezone: 'Asia/Manila' },
  );
}
