import { describe, expect, it, vi } from 'vitest';
import { MarkPortalNotificationReadUseCase } from '@modules/client-portal/application/use-cases/MarkPortalNotificationReadUseCase';
import { PortalNotification } from '@modules/client-portal/domain/PortalNotification';
import { PortalLoanApplicationNotFoundError } from '@modules/client-portal/domain/errors/PortalAuthErrors';

describe('MarkPortalNotificationReadUseCase', () => {
  it('marks the notification read when it belongs to the requesting portal account', async () => {
    const notification = PortalNotification.create({ portalAccountId: 'account-1', type: 'APPLICATION_APPROVED', title: 'Approved' });
    const portalNotificationRepository = { findById: vi.fn().mockResolvedValue(notification), markRead: vi.fn(), create: vi.fn(), findMany: vi.fn(), countUnread: vi.fn(), markAllRead: vi.fn() };
    const useCase = new MarkPortalNotificationReadUseCase({ portalNotificationRepository });

    await useCase.execute(notification.id, 'account-1');

    expect(portalNotificationRepository.markRead).toHaveBeenCalledWith(notification.id);
  });

  it('throws when the notification does not exist', async () => {
    const portalNotificationRepository = { findById: vi.fn().mockResolvedValue(null), markRead: vi.fn(), create: vi.fn(), findMany: vi.fn(), countUnread: vi.fn(), markAllRead: vi.fn() };
    const useCase = new MarkPortalNotificationReadUseCase({ portalNotificationRepository });

    await expect(useCase.execute('missing', 'account-1')).rejects.toThrow(PortalLoanApplicationNotFoundError);
    expect(portalNotificationRepository.markRead).not.toHaveBeenCalled();
  });

  it('throws when the notification belongs to a different portal account', async () => {
    const notification = PortalNotification.create({ portalAccountId: 'account-1', type: 'APPLICATION_APPROVED', title: 'Approved' });
    const portalNotificationRepository = { findById: vi.fn().mockResolvedValue(notification), markRead: vi.fn(), create: vi.fn(), findMany: vi.fn(), countUnread: vi.fn(), markAllRead: vi.fn() };
    const useCase = new MarkPortalNotificationReadUseCase({ portalNotificationRepository });

    await expect(useCase.execute(notification.id, 'account-2')).rejects.toThrow(PortalLoanApplicationNotFoundError);
    expect(portalNotificationRepository.markRead).not.toHaveBeenCalled();
  });
});
