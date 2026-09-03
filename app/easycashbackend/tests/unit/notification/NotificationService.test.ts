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
    findMaturedLoanAccounts: vi.fn().mockResolvedValue([]),
    findFirstAmortizationDueTodayLoanAccounts: vi.fn().mockResolvedValue([]),
  };
  const userRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    hasAnyUserWithRole: vi.fn(),
    findByRolesAndBranch: vi.fn().mockResolvedValue([]),
    findByRoles: vi.fn().mockResolvedValue([]),
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

  it('notifyPortalChatMessage notifies staff roles across every branch, using each recipient\'s own branchId', async () => {
    const { notificationRepository, userRepository } = buildDeps();
    userRepository.findByRoles.mockResolvedValue([
      { id: 'mis-1', branchId: 'branch-1' },
      { id: 'collector-2', branchId: 'branch-2' },
    ]);
    const service = new NotificationService({ notificationRepository, userRepository });

    await service.notifyPortalChatMessage({ conversationId: 'conv-1', portalAccountEmail: 'borrower@example.com' });

    expect(userRepository.findByRoles).toHaveBeenCalledWith(['MIS', 'Loan Operation Manager', 'Collection Officer']);
    expect(notificationRepository.create).toHaveBeenCalledTimes(2);
    const calls = notificationRepository.create.mock.calls.map((c) => c[0]);
    expect(calls.every((n) => n.type === 'PORTAL_CHAT_MESSAGE')).toBe(true);
    expect(calls.every((n) => n.entityId === 'conv-1')).toBe(true);
    expect(calls.find((n) => n.recipientUserId === 'mis-1')?.branchId).toBe('branch-1');
    expect(calls.find((n) => n.recipientUserId === 'collector-2')?.branchId).toBe('branch-2');
  });

  it('syncMaturedNotifications notifies staff LOAN_MATURED for each matured account not already notified recently', async () => {
    const { notificationRepository, userRepository } = buildDeps();
    notificationRepository.findMaturedLoanAccounts.mockResolvedValue([
      { id: 'loan-2', branchId: 'branch-1', loanCode: 'LN-0002', borrowerName: 'Juan Dela Cruz' },
    ]);
    userRepository.findByRolesAndBranch.mockResolvedValue([{ id: 'collector-1', branchId: 'branch-1' }]);
    const service = new NotificationService({ notificationRepository, userRepository });

    await service.syncMaturedNotifications();

    expect(notificationRepository.create).toHaveBeenCalledTimes(1);
    expect(notificationRepository.create.mock.calls[0][0].type).toBe('LOAN_MATURED');
    expect(notificationRepository.create.mock.calls[0][0].entityId).toBe('loan-2');
  });

  it('syncFirstAmortizationDueNotifications notifies staff LOAN_FIRST_AMORTIZATION_DUE_TODAY for each account due today', async () => {
    const { notificationRepository, userRepository } = buildDeps();
    notificationRepository.findFirstAmortizationDueTodayLoanAccounts.mockResolvedValue([
      { id: 'loan-3', branchId: 'branch-1', loanCode: 'LN-0003', borrowerName: 'Maria Santos' },
    ]);
    userRepository.findByRolesAndBranch.mockResolvedValue([{ id: 'collector-1', branchId: 'branch-1' }]);
    const service = new NotificationService({ notificationRepository, userRepository });

    await service.syncFirstAmortizationDueNotifications();

    expect(notificationRepository.create).toHaveBeenCalledTimes(1);
    expect(notificationRepository.create.mock.calls[0][0].type).toBe('LOAN_FIRST_AMORTIZATION_DUE_TODAY');
    expect(notificationRepository.create.mock.calls[0][0].entityId).toBe('loan-3');
  });

  it('runDailyScan runs all three live-computed scans', async () => {
    const { notificationRepository, userRepository } = buildDeps();
    notificationRepository.findOverdueLoanAccounts.mockResolvedValue([{ id: 'loan-1', branchId: 'branch-1', loanCode: 'LN-0001', borrowerName: 'A' }]);
    notificationRepository.findMaturedLoanAccounts.mockResolvedValue([{ id: 'loan-2', branchId: 'branch-1', loanCode: 'LN-0002', borrowerName: 'B' }]);
    notificationRepository.findFirstAmortizationDueTodayLoanAccounts.mockResolvedValue([{ id: 'loan-3', branchId: 'branch-1', loanCode: 'LN-0003', borrowerName: 'C' }]);
    userRepository.findByRolesAndBranch.mockResolvedValue([{ id: 'collector-1', branchId: 'branch-1' }]);
    const service = new NotificationService({ notificationRepository, userRepository });

    await service.runDailyScan();

    const types = notificationRepository.create.mock.calls.map((c) => c[0].type).sort();
    expect(types).toEqual(['LOAN_FIRST_AMORTIZATION_DUE_TODAY', 'LOAN_MATURED', 'LOAN_OVERDUE']);
  });
});
