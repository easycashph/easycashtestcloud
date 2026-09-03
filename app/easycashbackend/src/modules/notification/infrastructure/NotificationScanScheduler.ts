import { logger } from '@shared/logger/logger';
import type { NotificationService } from '../application/NotificationService';

/** How often the scheduler re-runs the daily scan (LOAN_OVERDUE, LOAN_MATURED,
 * LOAN_FIRST_AMORTIZATION_DUE_TODAY - see `NotificationService.runDailyScan`). Relaxed from every
 * 15 minutes to once a day (2026-09-03, event-driven notification redesign, user-confirmed) - all
 * three of these events are live-computed with no stored status transition to hook a write-time
 * notification off of, so some polling cadence is unavoidable for them; once daily is a reasonable
 * middle ground given none of the three need minute-level latency (unlike the other event types in
 * this redesign, which fire instantly at write-time - see RestructureLoanUseCase, AdjustLoanUseCase,
 * ProcessPaymentUseCase, CompromiseSettleLoanUseCase, SendPortalChatMessageUseCase). Not
 * user-configurable yet since nothing has asked for a different cadence. */
export const DAILY_SCAN_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Real periodic job for the three daily-scan notification types (2026-07-17, LOAN_OVERDUE only;
 * broadened 2026-09-03 to LOAN_MATURED and LOAN_FIRST_AMORTIZATION_DUE_TODAY too - see
 * `NotificationService.runDailyScan`'s own doc comment) - replaces the earlier lazy "sync whenever
 * anyone opens their bell" approach (see git history of `ListNotificationsUseCase` for that
 * predecessor). This codebase has no job-queue infrastructure (no BullMQ/Redis, no node-cron) and
 * runs as a single backend process behind Docker Compose (see CLAUDE.md's deployment philosophy -
 * self-hosted, minimize operational cost/complexity), so a plain `setInterval` in the same process
 * is the pragmatic choice here rather than adding new infrastructure for a handful of periodic
 * jobs. If this backend is ever run as multiple replicas, this would need to move to a single
 * designated instance (or a real distributed scheduler) to avoid duplicate concurrent scans - not a
 * concern at the current single-instance deployment scale.
 *
 * Errors are caught and logged per tick rather than left to crash the interval - a transient DB
 * hiccup on one run should not silently kill all future runs for the life of the process. Fires
 * once immediately on startup (in addition to the interval) so a scan happens promptly after every
 * deploy/restart rather than waiting up to a full day.
 */
export function startNotificationScanScheduler(
  notificationService: NotificationService,
  intervalMs: number = DAILY_SCAN_INTERVAL_MS,
): () => void {
  const tick = async () => {
    try {
      await notificationService.runDailyScan();
    } catch (error) {
      logger.error({ err: error }, 'Daily notification scan failed - will retry next interval.');
    }
  };

  void tick();
  const interval = setInterval(() => void tick(), intervalMs);
  // Don't hold the process open just for this timer during graceful shutdown.
  interval.unref();

  return () => clearInterval(interval);
}
