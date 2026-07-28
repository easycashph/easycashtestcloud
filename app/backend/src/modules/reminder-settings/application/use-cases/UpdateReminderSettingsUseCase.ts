import type { IReminderSettingsRepository, ReminderSettings } from '../ports/IReminderSettingsRepository';

export interface UpdateReminderSettingsCommand {
  smsEnabled?: boolean;
  emailEnabled?: boolean;
  signingSmsEnabled?: boolean;
  signingEmailEnabled?: boolean;
  portalEmailEnabled?: boolean;
  portalSmsEnabled?: boolean;
  updatedByUserId: string;
}

/** MIS-only (enforced by the HTTP layer's `requireRole('MIS')`, not here) - matches every other system-wide toggle in this codebase. */
export class UpdateReminderSettingsUseCase {
  constructor(private readonly deps: { reminderSettingsRepository: IReminderSettingsRepository }) {}

  async execute(command: UpdateReminderSettingsCommand): Promise<ReminderSettings> {
    return this.deps.reminderSettingsRepository.update(command);
  }
}
