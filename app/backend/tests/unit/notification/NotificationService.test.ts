import { describe, expect, it, vi } from 'vitest';
import { NotificationService } from '@modules/notification/application/NotificationService';

function buildDeps() {
  const notificationRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
    countUnread: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    existsRecent: vi.fn().mockResolvedValue(false),
    findOverdueLoanAccounts: vi.fn().mockResolvedValue([]),
  };
  const userRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    hasAnyUserWithRole: vi.fn(),
    findByRolesAndBranch: vi.fn().mockResolvedValue([]),
  };
  return { notificationRepository, userRepository };
}

describe('NotificationService', () => {
  it('notifyRoles creates one notification per matching user, excluding excludeUserId', async () => {
    const { notificationRepository, userRepository } = buildDeps();
    userRepository.findByRolesAndBranch.mockResolvedValue([
      { id: 'user-1', branchId: 'branch-1' },
      { id: 'user-2', branchId: 'branch-1' },
    ]);
    const service = new NotificationService({ notificationRepository, userRepository });

    await service.notifyRoles({
      roleNames: ['MIS'],
      branchId: 'branch-1',
      type: 'APPLICATION_SUBMITTED',
      title: 'New application',
      excludeUserId: 'user-1',
    });

    expect(notificationRepository.create).toHaveBeenCalledTimes(1);
    expect(notificationRepository.create.mock.calls[0][0].recipientUserId).toBe('user-2');
  });

  it('notifyUser creates exactly one notification for the given user', async () => {
    const { notificationRepository, userRepository } = buildDeps();
    const service = new NotificationService({ notificationRepository, userRepository });

    await service.notifyUser({ userId: 'user-9', branchId: 'branch-1', type: 'APPLICATION_DECIDED', title: 'Approved' });

    expect(notificationRepository.create).toHaveBeenCalledTimes(1);
    expect(notificationRepository.create.mock.calls[0][0].recipientUserId).toBe('user-9');
    expect(notificationRepository.create.mock.calls[0][0].type).toBe('APPLICATION_DECIDED');
  });

  it('syncOverdueNotifications notifies overdue-relevant roles for each overdue account not already notified recently', async () => {
    const { notificationRepository, userRepository } = buildDeps();
    notificationRepository.findOverdueLoanAccounts.mockResolvedValue([
      { id: 'loan-1', branchId: 'branch-1', loanCode: 'LN-0001' },
    ]);
    userRepository.findByRolesAndBranch.mockResolvedValue([{ id: 'collector-1', branchId: 'branch-1' }]);
    const service = new NotificationService({ notificationRepository, userRepository });

    await service.syncOverdueNotifications();

    expect(notificationRepository.create).toHaveBeenCalledTimes(1);
    expect(notificationRepository.create.mock.calls[0][0].type).toBe('LOAN_OVERDUE');
    expect(notificationRepository.create.mock.calls[0][0].entityId).toBe('loan-1');
  });

  it('syncOverdueNotifications skips an account already notified within the resync window', async () => {
    const { notificationRepository, userRepository } = buildDeps();
    notificationRepository.findOverdueLoanAccounts.mockResolvedValue([
      { id: 'loan-1', branchId: 'branch-1', loanCode: 'LN-0001' },
    ]);
    notificationRepository.existsRecent.mockResolvedValue(true);
    const service = new NotificationService({ notificationRepository, userRepository });

    await service.syncOverdueNotifications();

    expect(notificationRepository.create).not.toHaveBeenCalled();
    expect(userRepository.findByRolesAndBranch).not.toHaveBeenCalled();
  });
});
