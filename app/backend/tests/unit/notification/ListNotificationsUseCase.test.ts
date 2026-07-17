import { describe, expect, it, vi } from 'vitest';
import { ListNotificationsUseCase } from '@modules/notification/application/use-cases/ListNotificationsUseCase';
import { Notification } from '@modules/notification/domain/Notification';

describe('ListNotificationsUseCase', () => {
  it('syncs overdue notifications before listing, then returns items + unread count', async () => {
    const notification = Notification.create({
      recipientUserId: 'user-1',
      type: 'APPLICATION_SUBMITTED',
      title: 'New application',
      branchId: 'branch-1',
    });
    const notificationRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findMany: vi.fn().mockResolvedValue([notification]),
      countUnread: vi.fn().mockResolvedValue(3),
      markRead: vi.fn(),
      markAllRead: vi.fn(),
      existsRecent: vi.fn(),
      findOverdueLoanAccounts: vi.fn(),
    };
    const notificationService = { syncOverdueNotifications: vi.fn().mockResolvedValue(undefined) };
    const useCase = new ListNotificationsUseCase({ notificationRepository, notificationService: notificationService as never });

    const result = await useCase.execute({ recipientUserId: 'user-1', limit: 20 });

    expect(notificationService.syncOverdueNotifications).toHaveBeenCalledTimes(1);
    expect(result.items).toEqual([notification]);
    expect(result.unreadCount).toBe(3);
    expect(notificationRepository.findMany).toHaveBeenCalledWith({
      recipientUserId: 'user-1',
      limit: 20,
      cursor: undefined,
      unreadOnly: undefined,
    });
  });
});
