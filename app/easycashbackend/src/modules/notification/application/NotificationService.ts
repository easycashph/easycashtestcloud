/**
 * Notification Center application service (2026-07-17 user request). Same shape as
 * `ProfileActivityLogService` - a plain service (not a UseCase class), injected as an optional dep
 * into other modules' use cases and called as a side effect after their primary write succeeds.
 */
import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import type { INotificationRepository } from './ports/INotificationRepository';
import { Notification, type NotificationType } from '../domain/Notification';

export interface NotifyRolesInput {
  roleNames: string[];
  branchId: string;
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  /** Don't notify the user who caused the event themselves (e.g. don't tell an MIS reviewer "your
   * own application needs review" if they're also the one who submitted it). */
  excludeUserId?: string;
}

export interface NotifyUserInput {
  userId: string;
  branchId: string;
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}

/** LOAN_OVERDUE notifications go to these roles - the ones with a real collections/lending
 * responsibility, matching who already sees the Dashboard's Overdue Accounts figure and the Due &
 * Overdue (Payment Reminders) worklist most directly. */
const OVERDUE_NOTIFICATION_ROLES = ['MIS', 'Loan Operation Manager', 'Collection Officer'];

/** Anti-spam window for the LOAN_OVERDUE sync - see `syncOverdueNotifications` doc comment. */
const OVERDUE_RESYNC_WINDOW_HOURS = 24;

export class NotificationService {
  constructor(
    private readonly deps: { notificationRepository: INotificationRepository; userRepository: IUserRepository },
  ) {}

  async notifyRoles(input: NotifyRolesInput): Promise<void> {
    const recipients = await this.deps.userRepository.findByRolesAndBranch(input.roleNames, input.branchId);
    await Promise.all(
      recipients
        .filter((user) => user.id !== input.excludeUserId)
        .map((user) =>
          this.deps.notificationRepository.create(
            Notification.create({
              recipientUserId: user.id,
              type: input.type,
              title: input.title,
              body: input.body,
              entityType: input.entityType,
              entityId: input.entityId,
              branchId: input.branchId,
            }),
          ),
        ),
    );
  }

  async notifyUser(input: NotifyUserInput): Promise<void> {
    await this.deps.notificationRepository.create(
      Notification.create({
        recipientUserId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        entityType: input.entityType,
        entityId: input.entityId,
        branchId: input.branchId,
      }),
    );
  }

  /**
   * LOAN_OVERDUE sync - scans every currently-overdue loan account (same live definition as the
   * Dashboard's `overdueAccounts` figure) and creates one LOAN_OVERDUE notification per account
   * for MIS/Loan Operation Manager/Collection Officer at that account's branch, skipping any
   * account that already got one in the last 24h so staying overdue doesn't spam a fresh
   * notification on every run.
   *
   * 2026-07-17: called on a real periodic timer (`OverdueNotificationScheduler.ts`, started from
   * `server.ts`, every `OVERDUE_SYNC_INTERVAL_MS`) - not tied to user activity. Previously ran as
   * a lazy substitute inside `ListNotificationsUseCase.execute` (once per bell poll, every 30s per
   * connected user) because no scheduler existed in this codebase; replaced once one did, both for
   * genuine real-time-ness (independent of whether anyone happens to have the app open) and to
   * stop re-running the overdue scan on every single poll.
   */
  async syncOverdueNotifications(): Promise<void> {
    const overdueAccounts = await this.deps.notificationRepository.findOverdueLoanAccounts(new Date());
    const resyncCutoff = new Date(Date.now() - OVERDUE_RESYNC_WINDOW_HOURS * 60 * 60 * 1000);

    for (const account of overdueAccounts) {
      const alreadyNotifiedRecently = await this.deps.notificationRepository.existsRecent('LOAN_OVERDUE', account.id, resyncCutoff);
      if (alreadyNotifiedRecently) continue;

      await this.notifyRoles({
        roleNames: OVERDUE_NOTIFICATION_ROLES,
        branchId: account.branchId,
        type: 'LOAN_OVERDUE',
        title: `Loan ${account.loanCode} (${account.borrowerName}) is overdue`,
        body: 'At least one installment is past due and not fully paid.',
        entityType: 'LoanAccount',
        entityId: account.id,
      });
    }
  }
}
