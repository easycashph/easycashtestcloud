import type { INotificationRepository } from '../ports/INotificationRepository';
import type { Notification } from '../../domain/Notification';

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
  constructor(private readonly deps: { notificationRepository: INotificationRepository }) {}

  async execute(input: ListNotificationsInput): Promise<ListNotificationsResult> {
    // 2026-07-17: used to run NotificationService.syncOverdueNotifications() here as a lazy
    // substitute for a real scheduler - replaced by an actual periodic job (see
    // `NotificationScanScheduler.ts`, started from `server.ts`), so this no longer needs to run
    // the overdue scan on every single bell poll (previously every 30s per connected user).
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
