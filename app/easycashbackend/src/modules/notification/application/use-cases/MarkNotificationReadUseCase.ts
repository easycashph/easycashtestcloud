import { ForbiddenError, NotFoundError } from '@shared/errors/DomainError';
import type { INotificationRepository } from '../ports/INotificationRepository';

export class MarkNotificationReadUseCase {
  constructor(private readonly deps: { notificationRepository: INotificationRepository }) {}

  async execute(id: string, requestingUserId: string): Promise<void> {
    const notification = await this.deps.notificationRepository.findById(id);
    if (!notification) throw new NotFoundError('Notification', id);
    if (notification.recipientUserId !== requestingUserId) {
      throw new ForbiddenError('This notification does not belong to you.');
    }
    await this.deps.notificationRepository.markRead(id);
  }
}
