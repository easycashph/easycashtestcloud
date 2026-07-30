import { describe, expect, it, vi } from 'vitest';
import { PortalOtpSender } from '@modules/client-portal/infrastructure/PortalOtpSender';
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

function buildDeps(settings: ReminderSettings) {
  const smsGateway = { send: vi.fn().mockResolvedValue(undefined) };
  const emailGateway = { send: vi.fn().mockResolvedValue(undefined) };
  const reminderSettingsRepository: Partial<IReminderSettingsRepository> = { get: vi.fn().mockResolvedValue(settings) };
  return { smsGateway, emailGateway, reminderSettingsRepository: reminderSettingsRepository as IReminderSettingsRepository };
}

describe('PortalOtpSender', () => {
  it('does not send an email when portalEmailEnabled is off (dry-run)', async () => {
    const deps = buildDeps(BASE_SETTINGS);
    await new PortalOtpSender(deps).send('EMAIL', 'client@example.com', '123456');
    expect(deps.emailGateway.send).not.toHaveBeenCalled();
  });

  it('sends a real email when portalEmailEnabled is on', async () => {
    const deps = buildDeps({ ...BASE_SETTINGS, portalEmailEnabled: true });
    await new PortalOtpSender(deps).send('EMAIL', 'client@example.com', '123456');
    expect(deps.emailGateway.send).toHaveBeenCalledWith('client@example.com', 'Your Easycash Portal verification code', expect.stringContaining('123456'));
  });

  it('does not send an SMS when portalSmsEnabled is off (dry-run)', async () => {
    const deps = buildDeps(BASE_SETTINGS);
    await new PortalOtpSender(deps).send('SMS', '09171234567', '654321');
    expect(deps.smsGateway.send).not.toHaveBeenCalled();
  });

  it('sends a real SMS when portalSmsEnabled is on', async () => {
    const deps = buildDeps({ ...BASE_SETTINGS, portalSmsEnabled: true });
    await new PortalOtpSender(deps).send('SMS', '09171234567', '654321');
    expect(deps.smsGateway.send).toHaveBeenCalledWith('09171234567', expect.stringContaining('654321'));
  });

  it('is unaffected by the payment-reminder smsEnabled/emailEnabled flags, only its own portal* flags', async () => {
    const deps = buildDeps({ ...BASE_SETTINGS, smsEnabled: true, emailEnabled: true, portalEmailEnabled: false, portalSmsEnabled: false });
    await new PortalOtpSender(deps).send('EMAIL', 'client@example.com', '111111');
    await new PortalOtpSender(deps).send('SMS', '09171234567', '222222');
    expect(deps.emailGateway.send).not.toHaveBeenCalled();
    expect(deps.smsGateway.send).not.toHaveBeenCalled();
  });
});
