/**
 * Notification Center application service (2026-07-17 user request). Same shape as
 * `ProfileActivityLogService` - a plain service (not a UseCase class), injected as an optional dep
 * into other modules' use cases and called as a side effect after their primary write succeeds.
 */
import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import { manilaDayRange } from '@shared/domain/manilaTime';
import type { INotificationRepository, LoanAccountNotificationTarget } from './ports/INotificationRepository';
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

export type NotifyStaffInput = Omit<NotifyRolesInput, 'roleNames'>;

/** 2026-09-03 (event-driven notification redesign, user-confirmed): the standard recipient set for
 * every loan-lifecycle and portal-chat notification this service sends - one shared role set,
 * not customized per event type. Originally scoped to LOAN_OVERDUE alone (the roles with a real
 * collections/lending responsibility, matching who already sees the Dashboard's Overdue Accounts
 * figure and the Due & Overdue worklist), now reused for every event below. */
const NOTIFICATION_STAFF_ROLES = ['MIS', 'Loan Operation Manager', 'Collection Officer'];

/** Anti-spam window shared by every daily-scan sync method below - see `syncLoanAccountEvent`'s own
 * doc comment. Was LOAN_OVERDUE-only when the scan ran every 15 minutes; now that the whole scan is
 * itself daily (2026-09-03 redesign - see `NotificationScanScheduler.ts`), this is mostly a safety
 * net against the job running more than once in a day (a manual trigger, a backend restart at an
 * odd time) rather than the primary anti-spam mechanism it used to be. */
const NOTIFICATION_RESYNC_WINDOW_HOURS = 24;

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

  /**
   * Branch-scoped notification to `NOTIFICATION_STAFF_ROLES` (MIS/Loan Operation Manager/
   * Collection Officer) - the one shared recipient set every loan-lifecycle event in this
   * redesign uses (2026-09-03, user-confirmed: "hindi na kailangang iba-iba per event type").
   * Callers never need to know or import the actual role list - it's encapsulated here as the
   * single source of truth, same reasoning `notifyPortalChatMessage` applies for its own
   * (cross-branch) recipient resolution.
   */
  async notifyStaff(input: NotifyStaffInput): Promise<void> {
    await this.notifyRoles({ ...input, roleNames: NOTIFICATION_STAFF_ROLES });
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
   * PORTAL_CHAT_MESSAGE - a borrower sent a message on the Client Portal's chat widget
   * (`SendPortalChatMessageUseCase`). Unlike every other event this service handles,
   * `ChatConversation` carries no `branchId` of its own (it's not scoped to one branch's loans -
   * see `ChatConversationRecord`), so this can't reuse `notifyRoles`' single-branchId shape.
   * Notifies `NOTIFICATION_STAFF_ROLES` across EVERY branch instead (`findByRoles`), stamping each
   * created `Notification` with that RECIPIENT's own branchId - satisfies the required FK without
   * pretending the conversation itself belongs to any one branch.
   */
  async notifyPortalChatMessage(input: { conversationId: string; portalAccountEmail: string | null }): Promise<void> {
    const recipients = await this.deps.userRepository.findByRoles(NOTIFICATION_STAFF_ROLES);
    await Promise.all(
      recipients.map((user) =>
        this.deps.notificationRepository.create(
          Notification.create({
            recipientUserId: user.id,
            type: 'PORTAL_CHAT_MESSAGE',
            title: `New Portal chat message from ${input.portalAccountEmail ?? 'a client'}`,
            body: 'A borrower sent a message in the Portal chat.',
            entityType: 'ChatConversation',
            entityId: input.conversationId,
            branchId: user.branchId,
          }),
        ),
      ),
    );
  }

  /**
   * Shared by every daily-scan sync method: creates one notification per account in `accounts`,
   * skipping any that already got this exact type within the anti-spam window so a loan sitting in
   * the same state day after day doesn't get a fresh notification on every scan.
   */
  private async syncLoanAccountEvent(
    accounts: LoanAccountNotificationTarget[],
    type: NotificationType,
    title: (account: LoanAccountNotificationTarget) => string,
    body: string,
  ): Promise<void> {
    const resyncCutoff = new Date(Date.now() - NOTIFICATION_RESYNC_WINDOW_HOURS * 60 * 60 * 1000);

    for (const account of accounts) {
      const alreadyNotifiedRecently = await this.deps.notificationRepository.existsRecent(type, account.id, resyncCutoff);
      if (alreadyNotifiedRecently) continue;

      await this.notifyStaff({
        branchId: account.branchId,
        type,
        title: title(account),
        body,
        entityType: 'LoanAccount',
        entityId: account.id,
      });
    }
  }

  /**
   * LOAN_OVERDUE sync - scans every currently-overdue loan account (same live definition as the
   * Dashboard's `overdueAccounts` figure) and creates one LOAN_OVERDUE notification per account
   * for MIS/Loan Operation Manager/Collection Officer at that account's branch.
   *
   * 2026-07-17: originally called on a real periodic timer every 15 minutes
   * (`OverdueNotificationScheduler.ts`). 2026-09-03 (event-driven redesign, user-confirmed): "Past
   * Due" has no stored status transition to hook - it's computed live from `repayment_schedules`,
   * same as LOAN_MATURED/LOAN_FIRST_AMORTIZATION_DUE_TODAY below - so a genuinely instant,
   * write-time notification isn't possible for any of these three. Cadence relaxed from every 15
   * minutes to once daily instead (`NotificationScanScheduler.ts`, `runDailyScan()` below) - a
   * reasonable middle ground given none of these three events need minute-level latency.
   */
  async syncOverdueNotifications(): Promise<void> {
    const overdueAccounts = await this.deps.notificationRepository.findOverdueLoanAccounts(new Date());
    await this.syncLoanAccountEvent(
      overdueAccounts,
      'LOAN_OVERDUE',
      (a) => `Loan ${a.loanCode} (${a.borrowerName}) is overdue`,
      'At least one installment is past due and not fully paid.',
    );
  }

  /**
   * LOAN_MATURED sync (2026-09-03, event-driven redesign) - same live "matured" definition as the
   * `isMatured` API flag (`ListMaturedLoanAccountIdsUseCase`/`findMaturedLoanAccountIds`): full
   * scheduled term over, still unpaid. No stored status transition exists for this either - see
   * `syncOverdueNotifications`'s own doc comment for why this runs on the same daily scan.
   */
  async syncMaturedNotifications(): Promise<void> {
    const maturedAccounts = await this.deps.notificationRepository.findMaturedLoanAccounts(new Date());
    await this.syncLoanAccountEvent(
      maturedAccounts,
      'LOAN_MATURED',
      (a) => `Loan ${a.loanCode} (${a.borrowerName}) has matured`,
      'The full scheduled term is over and the loan is still unpaid.',
    );
  }

  /**
   * LOAN_FIRST_AMORTIZATION_DUE_TODAY sync (2026-09-03, event-driven redesign) - same "always
   * installment #1, optionally date-filtered on its own due date" definition
   * `getFirstAmortizationReport` already uses, narrowed to today's Asia/Manila calendar day.
   */
  async syncFirstAmortizationDueNotifications(): Promise<void> {
    const { start, end } = manilaDayRange(new Date());
    const dueTodayAccounts = await this.deps.notificationRepository.findFirstAmortizationDueTodayLoanAccounts(start, end);
    await this.syncLoanAccountEvent(
      dueTodayAccounts,
      'LOAN_FIRST_AMORTIZATION_DUE_TODAY',
      (a) => `Loan ${a.loanCode} (${a.borrowerName})'s first amortization is due today`,
      "This loan's first installment is due today.",
    );
  }

  /** Entry point for `NotificationScanScheduler.ts`'s once-daily tick - runs all three live-
   * computed, no-stored-transition scans in sequence. */
  async runDailyScan(): Promise<void> {
    await this.syncOverdueNotifications();
    await this.syncMaturedNotifications();
    await this.syncFirstAmortizationDueNotifications();
  }
}
