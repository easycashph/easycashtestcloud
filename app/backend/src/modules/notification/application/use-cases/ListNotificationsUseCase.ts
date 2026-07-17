import type { INotificationRepository } from '../ports/INotificationRepository';
import type { Notification } from '../../domain/Notification';
import type { NotificationService } from '../NotificationService';

export interface ListNotificationsInput {
  recipientUserId: string;
  limit: number;
  cursor?: string;
  unreadOnly?: boolean;
}

export interface ListNotificationsResult {
  items: Notification[];
  unreadCount: number;
}

export class ListNotificationsUseCase {
  constructor(
    private readonly deps: { notificationRepository: INotificationRepository; notificationService: NotificationService },
  ) {}

  async execute(input: ListNotificationsInput): Promise<ListNotificationsResult> {
    // Runs the LOAN_OVERDUE lazy sync before reading the list back, so a freshly-overdue account
    // shows up the first time anyone opens their bell after it crossed over - see
    // NotificationService.syncOverdueNotifications's own doc comment for why this exists instead
    // of a real job scheduler.
    await this.deps.notificationService.syncOverdueNotifications();

    const [items, unreadCount] = await Promise.all([
      this.deps.notificationRepository.findMany({
        recipientUserId: input.recipientUserId,
        limit: input.limit,
        cursor: input.cursor,
        unreadOnly: input.unreadOnly,
      }),
      this.deps.notificationRepository.countUnread(input.recipientUserId),
    ]);

    return { items, unreadCount };
  }
}
