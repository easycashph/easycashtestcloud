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
   * LOAN_OVERDUE sync - a lazy substitute for a real job scheduler, which doesn't exist anywhere
   * in this codebase yet (the `payment-reminder` module is a read-only worklist, not a scheduled
   * send mechanism - see its own doc comments). Called once per `ListNotificationsUseCase.execute`
   * (i.e. whenever any authenticated user opens their notification bell): scans every currently-
   * overdue loan account (same live definition as the Dashboard's `overdueAccounts` figure) and
   * creates one LOAN_OVERDUE notification per account for MIS/Loan Operation Manager/Collection
   * Officer at that account's branch, skipping any account that already got one in the last 24h so
   * staying overdue doesn't spam a fresh notification on every page load.
   *
   * Known, disclosed limitation: an account that JUST became overdue won't get a notification
   * until the next time *someone* opens their bell - not truly real-time, since nothing in this
   * codebase runs on a timer. A real fix needs an actual job scheduler, which is out of scope for
   * this feature (see docs/SESSION_LOG for the follow-up note) - this sync exists so the feature
   * still surfaces overdue accounts today rather than omitting them entirely.
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
        title: `Loan ${account.loanCode} is overdue`,
        body: 'At least one installment is past due and not fully paid.',
        entityType: 'LoanAccount',
        entityId: account.id,
      });
    }
  }
}
