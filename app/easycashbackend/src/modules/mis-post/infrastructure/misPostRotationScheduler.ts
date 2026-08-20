import cron from 'node-cron';
import { logger } from '@shared/logger/logger';
import type { AdvanceAutoRotationUseCase } from '../application/use-cases/AdvanceAutoRotationUseCase';

/** Same shape as `financeNewsScheduler.ts` - deliberately NOT started from `createApp()` (which
 * the test suite also imports via supertest); a real cron timer has no place running during
 * tests. Call once from src/server.ts. Advances the AUTO_ROTATION pool by exactly one item, once
 * per day (2026-08-20 user request). */
export function startMisPostRotationScheduler(deps: {
  advanceAutoRotationUseCase: AdvanceAutoRotationUseCase;
  cronExpression: string;
}): void {
  cron.schedule(
    deps.cronExpression,
    () => {
      deps.advanceAutoRotationUseCase
        .execute()
        .then(() => logger.info('MIS post auto-rotation advanced'))
        .catch((error) => logger.error({ error }, 'MIS post auto-rotation job crashed'));
    },
    { timezone: 'Asia/Manila' },
  );
}
