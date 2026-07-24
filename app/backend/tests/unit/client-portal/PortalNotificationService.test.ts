import { describe, expect, it, vi } from 'vitest';
import { PortalNotificationService } from '@modules/client-portal/application/PortalNotificationService';
import type { IReminderSettingsRepository, ReminderSettings } from '@modules/reminder-settings/application/ports/IReminderSettingsRepository';

const BASE_SETTINGS: ReminderSettings = {
  smsEnabled: false,
  emailEnabled: false,
  signingSmsEnabled: false,
  portalEmailEnabled: false,
  portalSmsEnabled: false,
  updatedAt: new Date(),
  updatedByUserId: null,
};

const ACCOUNT = { id: 'account-1', email: 'client@example.com', contactNumber: '09171234567' };

function buildDeps(settings: ReminderSettings, account: unknown = ACCOUNT) {
  const portalNotificationRepository = { create: vi.fn().mockResolvedValue(undefined), findById: vi.fn(), findMany: vi.fn(), countUnread: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() };
  const portalAccountRepository = { findById: vi.fn().mockResolvedValue(account) };
  const smsGateway = { send: vi.fn().mockResolvedValue(undefined) };
  const emailGateway = { send: vi.fn().mockResolvedValue(undefined) };
  const reminderSettingsRepository: Partial<IReminderSettingsRepository> = { get: vi.fn().mockResolvedValue(settings) };
  return {
    portalNotificationRepository,
    portalAccountRepository: portalAccountRepository as never,
    smsGateway,
    emailGateway,
    reminderSettingsRepository: reminderSettingsRepository as IReminderSettingsRepository,
  };
}

describe('PortalNotificationService', () => {
  it('always writes the in-app bell notification, even when email/SMS are both off', async () => {
    const deps = buildDeps(BASE_SETTINGS);
    await new PortalNotificationService(deps).notify({ portalAccountId: 'account-1', type: 'APPLICATION_APPROVED', title: 'Approved: Juan Dela Cruz' });
    expect(deps.portalNotificationRepository.create).toHaveBeenCalledTimes(1);
    expect(deps.emailGateway.send).not.toHaveBeenCalled();
    expect(deps.smsGateway.send).not.toHaveBeenCalled();
  });

  it('sends a real email when portalEmailEnabled is on', async () => {
    const deps = buildDeps({ ...BASE_SETTINGS, portalEmailEnabled: true });
    await new PortalNotificationService(deps).notify({ portalAccountId: 'account-1', type: 'APPLICATION_APPROVED', title: 'Approved: Juan Dela Cruz' });
    expect(deps.emailGateway.send).toHaveBeenCalledWith('client@example.com', 'Approved: Juan Dela Cruz', 'Approved: Juan Dela Cruz');
  });

  it('sends a real SMS when portalSmsEnabled is on and a contact number is on file', async () => {
    const deps = buildDeps({ ...BASE_SETTINGS, portalSmsEnabled: true });
    await new PortalNotificationService(deps).notify({ portalAccountId: 'account-1', type: 'APPLICATION_DECLINED', title: 'Declined: Juan Dela Cruz' });
    expect(deps.smsGateway.send).toHaveBeenCalledWith('09171234567', 'Declined: Juan Dela Cruz - Declined: Juan Dela Cruz');
  });

  it('skips SMS when portalSmsEnabled is on but no contact number is on file', async () => {
    const deps = buildDeps({ ...BASE_SETTINGS, portalSmsEnabled: true }, { ...ACCOUNT, contactNumber: null });
    await new PortalNotificationService(deps).notify({ portalAccountId: 'account-1', type: 'APPLICATION_APPROVED', title: 'Approved' });
    expect(deps.smsGateway.send).not.toHaveBeenCalled();
  });

  it('is unaffected by the staff smsEnabled/emailEnabled flags, only its own portal* flags', async () => {
    const deps = buildDeps({ ...BASE_SETTINGS, smsEnabled: true, emailEnabled: true, portalEmailEnabled: false, portalSmsEnabled: false });
    await new PortalNotificationService(deps).notify({ portalAccountId: 'account-1', type: 'APPLICATION_APPROVED', title: 'Approved' });
    expect(deps.emailGateway.send).not.toHaveBeenCalled();
    expect(deps.smsGateway.send).not.toHaveBeenCalled();
  });

  it('does nothing further when the portal account no longer exists', async () => {
    const deps = buildDeps({ ...BASE_SETTINGS, portalEmailEnabled: true, portalSmsEnabled: true }, null);
    await new PortalNotificationService(deps).notify({ portalAccountId: 'missing', type: 'APPLICATION_APPROVED', title: 'Approved' });
    expect(deps.portalNotificationRepository.create).toHaveBeenCalledTimes(1);
    expect(deps.emailGateway.send).not.toHaveBeenCalled();
    expect(deps.smsGateway.send).not.toHaveBeenCalled();
  });
});
