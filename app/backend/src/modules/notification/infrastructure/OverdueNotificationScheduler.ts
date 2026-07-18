import { logger } from '@shared/logger/logger';
import type { NotificationService } from '../application/NotificationService';

/** How often the scheduler re-scans for newly-overdue loan accounts. Chosen as a reasonable
 * balance for this deployment's scale (single branch, low thousands of loans) - not
 * user-configurable yet since nothing has asked for a different cadence. */
export const OVERDUE_SYNC_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Real periodic job for LOAN_OVERDUE notifications (2026-07-17) - replaces the earlier lazy
 * "sync whenever anyone opens their bell" approach (see git history of `ListNotificationsUseCase`
 * for that predecessor). This codebase has no job-queue infrastructure (no BullMQ/Redis, no
 * node-cron) and runs as a single backend process behind Docker Compose (see CLAUDE.md's
 * deployment philosophy - self-hosted, minimize operational cost/complexity), so a plain
 * `setInterval` in the same process is the pragmatic choice here rather than adding new
 * infrastructure for a single periodic job. If this backend is ever run as multiple replicas,
 * this would need to move to a single designated instance (or a real distributed scheduler) to
 * avoid duplicate concurrent syncs - not a concern at the current single-instance deployment scale.
 *
 * Errors are caught and logged per tick rather than left to crash the interval - a transient DB
 * hiccup on one run should not silently kill all future runs for the life of the process.
 */
export function startOverdueNotificationScheduler(
  notificationService: NotificationService,
  intervalMs: number = OVERDUE_SYNC_INTERVAL_MS,
): () => void {
  const tick = async () => {
    try {
      await notificationService.syncOverdueNotifications();
    } catch (error) {
      logger.error({ err: error }, 'Overdue notification sync failed - will retry next interval.');
    }
  };

  void tick();
  const interval = setInterval(() => void tick(), intervalMs);
  // Don't hold the process open just for this timer during graceful shutdown.
  interval.unref();

  return () => clearInterval(interval);
}
