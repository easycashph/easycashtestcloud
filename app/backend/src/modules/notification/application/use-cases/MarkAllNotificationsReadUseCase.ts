import type { INotificationRepository } from '../ports/INotificationRepository';

export class MarkAllNotificationsReadUseCase {
  constructor(private readonly deps: { notificationRepository: INotificationRepository }) {}

  async execute(recipientUserId: string): Promise<void> {
    await this.deps.notificationRepository.markAllRead(recipientUserId);
  }
}
