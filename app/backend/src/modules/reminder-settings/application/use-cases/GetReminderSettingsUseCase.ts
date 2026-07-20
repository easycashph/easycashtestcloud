import type { IReminderSettingsRepository, ReminderSettings } from '../ports/IReminderSettingsRepository';

export class GetReminderSettingsUseCase {
  constructor(private readonly deps: { reminderSettingsRepository: IReminderSettingsRepository }) {}

  async execute(): Promise<ReminderSettings> {
    return this.deps.reminderSettingsRepository.get();
  }
}
