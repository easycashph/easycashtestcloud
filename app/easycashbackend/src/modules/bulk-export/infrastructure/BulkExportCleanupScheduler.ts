import cron from 'node-cron';
import { logger } from '@shared/logger/logger';
import type { CleanupBulkExportJobsUseCase } from '../application/use-cases/CleanupBulkExportJobsUseCase';

/** Same shape as `misPostRotationScheduler.ts` - deliberately NOT started from `createApp()` (the
 * test suite also imports via supertest); a real cron timer has no place running during tests. Call
 * once from src/server.ts. Prunes completed export ZIPs older than 7 days, once per day
 * (2026-08-24, user-confirmed retention). */
export function startBulkExportCleanupScheduler(deps: { cleanupBulkExportJobsUseCase: CleanupBulkExportJobsUseCase }): void {
  cron.schedule(
    '0 3 * * *',
    () => {
      deps.cleanupBulkExportJobsUseCase
        .execute()
        .then(() => logger.info('Bulk export cleanup ran'))
        .catch((error) => logger.error({ error }, 'Bulk export cleanup job crashed'));
    },
    { timezone: 'Asia/Manila' },
  );
}
