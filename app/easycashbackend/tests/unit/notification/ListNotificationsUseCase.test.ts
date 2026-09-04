import { describe, expect, it, vi } from 'vitest';
import { ListNotificationsUseCase } from '@modules/notification/application/use-cases/ListNotificationsUseCase';
import { Notification } from '@modules/notification/domain/Notification';

describe('ListNotificationsUseCase', () => {
  it('returns items + unread count for the requesting recipient', async () => {
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
      existsEver: vi.fn(),
      findOverdueLoanAccounts: vi.fn(),
    };
    const useCase = new ListNotificationsUseCase({ notificationRepository });

    const result = await useCase.execute({ recipientUserId: 'user-1', limit: 20 });

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
