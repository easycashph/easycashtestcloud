import { describe, expect, it, vi } from 'vitest';
import { MarkNotificationReadUseCase } from '@modules/notification/application/use-cases/MarkNotificationReadUseCase';
import { Notification } from '@modules/notification/domain/Notification';
import { ForbiddenError, NotFoundError } from '@shared/errors/DomainError';

describe('MarkNotificationReadUseCase', () => {
  it('throws NotFoundError when the notification does not exist', async () => {
    const notificationRepository = { findById: vi.fn().mockResolvedValue(null), markRead: vi.fn() };
    const useCase = new MarkNotificationReadUseCase({ notificationRepository: notificationRepository as never });

    await expect(useCase.execute('missing', 'user-1')).rejects.toThrow(NotFoundError);
    expect(notificationRepository.markRead).not.toHaveBeenCalled();
  });

  it("throws ForbiddenError when the notification doesn't belong to the requesting user", async () => {
    const notification = Notification.create({
      recipientUserId: 'someone-else',
      type: 'APPLICATION_SUBMITTED',
      title: 'New application',
      branchId: 'branch-1',
    });
    const notificationRepository = { findById: vi.fn().mockResolvedValue(notification), markRead: vi.fn() };
    const useCase = new MarkNotificationReadUseCase({ notificationRepository: notificationRepository as never });

    await expect(useCase.execute(notification.id, 'user-1')).rejects.toThrow(ForbiddenError);
    expect(notificationRepository.markRead).not.toHaveBeenCalled();
  });

  it('marks the notification read when it belongs to the requesting user', async () => {
    const notification = Notification.create({
      recipientUserId: 'user-1',
      type: 'APPLICATION_SUBMITTED',
      title: 'New application',
      branchId: 'branch-1',
    });
    const notificationRepository = { findById: vi.fn().mockResolvedValue(notification), markRead: vi.fn() };
    const useCase = new MarkNotificationReadUseCase({ notificationRepository: notificationRepository as never });

    await useCase.execute(notification.id, 'user-1');

    expect(notificationRepository.markRead).toHaveBeenCalledWith(notification.id);
  });
});
