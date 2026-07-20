import { describe, expect, it, vi } from 'vitest';
import { GetReminderSettingsUseCase } from '@modules/reminder-settings/application/use-cases/GetReminderSettingsUseCase';
import { UpdateReminderSettingsUseCase } from '@modules/reminder-settings/application/use-cases/UpdateReminderSettingsUseCase';

describe('GetReminderSettingsUseCase', () => {
  it('returns whatever the repository reports', async () => {
    const settings = { smsEnabled: false, emailEnabled: true, updatedAt: new Date(), updatedByUserId: 'user-1' };
    const reminderSettingsRepository = { get: vi.fn().mockResolvedValue(settings), update: vi.fn() };
    const useCase = new GetReminderSettingsUseCase({ reminderSettingsRepository });

    const result = await useCase.execute();

    expect(result).toEqual(settings);
  });
});

describe('UpdateReminderSettingsUseCase', () => {
  it('forwards the command to the repository', async () => {
    const updated = { smsEnabled: true, emailEnabled: false, updatedAt: new Date(), updatedByUserId: 'user-1' };
    const reminderSettingsRepository = { get: vi.fn(), update: vi.fn().mockResolvedValue(updated) };
    const useCase = new UpdateReminderSettingsUseCase({ reminderSettingsRepository });

    const result = await useCase.execute({ smsEnabled: true, updatedByUserId: 'user-1' });

    expect(reminderSettingsRepository.update).toHaveBeenCalledWith({ smsEnabled: true, updatedByUserId: 'user-1' });
    expect(result).toEqual(updated);
  });
});
