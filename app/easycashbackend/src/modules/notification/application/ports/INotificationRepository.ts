import type { Notification } from '../../domain/Notification';

export interface FindManyNotificationsOptions {
  recipientUserId: string;
  limit: number;
  cursor?: string;
  /** When true, only unread notifications - used by the bell dropdown's default view. */
  unreadOnly?: boolean;
}

export interface INotificationRepository {
  create(notification: Notification): Promise<void>;
  findById(id: string): Promise<Notification | null>;
  findMany(options: FindManyNotificationsOptions): Promise<Notification[]>;
  countUnread(recipientUserId: string): Promise<number>;
  markRead(id: string): Promise<void>;
  markAllRead(recipientUserId: string): Promise<void>;
  /** Anti-spam guard for the LOAN_OVERDUE sync (see NotificationService.syncOverdueNotifications) -
   * true if a notification of this type/entity was already created within the given window, so the
   * sync doesn't recreate one on every page load while a loan stays overdue. */
  existsRecent(type: string, entityId: string, sinceCreatedAt: Date): Promise<boolean>;
  /** Every loan account currently overdue (same live due-date-based definition as the Dashboard's
   * `overdueAccounts` figure - `PrismaDashboardRepository.findOverdueLoanAccounts`), used only by
   * `NotificationService.syncOverdueNotifications`. Lives here rather than a separate port since
   * it exists purely to feed notification creation, not as a general-purpose loan account query. */
  findOverdueLoanAccounts(asOf: Date): Promise<{ id: string; branchId: string; loanCode: string }[]>;
}
