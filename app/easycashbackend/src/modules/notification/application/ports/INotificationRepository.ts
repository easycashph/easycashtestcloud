import type { Notification } from '../../domain/Notification';

export interface FindManyNotificationsOptions {
  recipientUserId: string;
  limit: number;
  cursor?: string;
  /** When true, only unread notifications - used by the bell dropdown's default view. */
  unreadOnly?: boolean;
}

export interface LoanAccountNotificationTarget {
  id: string;
  branchId: string;
  loanCode: string;
  borrowerName: string;
}

export interface INotificationRepository {
  create(notification: Notification): Promise<void>;
  findById(id: string): Promise<Notification | null>;
  findMany(options: FindManyNotificationsOptions): Promise<Notification[]>;
  countUnread(recipientUserId: string): Promise<number>;
  markRead(id: string): Promise<void>;
  markAllRead(recipientUserId: string): Promise<void>;
  /** Anti-spam guard for LOAN_FIRST_AMORTIZATION_DUE_TODAY (see NotificationService's sync*
   * methods) - true if a notification of this type/entity was already created within the given
   * window, so a daily re-scan doesn't recreate one for a loan whose first installment is due
   * "today" across more than one scan on the same calendar day. */
  existsRecent(type: string, entityId: string, sinceCreatedAt: Date): Promise<boolean>;
  /** Anti-spam guard for LOAN_OVERDUE/LOAN_MATURED (2026-09-04, user-confirmed: each should fire
   * exactly once - the first scan that finds the loan overdue/matured, not a recurring daily
   * reminder for as long as the condition persists). True if a notification of this type/entity
   * was EVER created, with no time window - unlike `existsRecent` above. */
  existsEver(type: string, entityId: string): Promise<boolean>;
  /** Every loan account currently overdue (same live due-date-based definition as the Dashboard's
   * `overdueAccounts` figure - `PrismaDashboardRepository.findOverdueLoanAccounts`), used only by
   * `NotificationService.syncOverdueNotifications`. Lives here rather than a separate port since
   * it exists purely to feed notification creation, not as a general-purpose loan account query. */
  findOverdueLoanAccounts(asOf: Date): Promise<LoanAccountNotificationTarget[]>;
  /** Every loan account currently matured (same live definition as
   * `PrismaLoanAccountRepository.findMaturedLoanAccountIds`/the `isMatured` API flag), used only by
   * `NotificationService.syncMaturedNotifications`. */
  findMaturedLoanAccounts(asOf: Date): Promise<LoanAccountNotificationTarget[]>;
  /** Every loan account whose installment #1 is due within [dayStart, dayEnd) - used only by
   * `NotificationService.syncFirstAmortizationDueNotifications`. */
  findFirstAmortizationDueTodayLoanAccounts(dayStart: Date, dayEnd: Date): Promise<LoanAccountNotificationTarget[]>;
}
