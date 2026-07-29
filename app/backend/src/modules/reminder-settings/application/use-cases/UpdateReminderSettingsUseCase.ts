import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import type { IReminderSettingsRepository, ReminderSettings } from '../ports/IReminderSettingsRepository';

export interface UpdateReminderSettingsCommand {
  smsEnabled?: boolean;
  emailEnabled?: boolean;
  signingSmsEnabled?: boolean;
  signingEmailEnabled?: boolean;
  portalEmailEnabled?: boolean;
  portalSmsEnabled?: boolean;
  updatedByUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

/** field key -> human label, used for the Settings > System > Activity log panel (2026-07-29). */
const TOGGLE_LABELS: Record<string, string> = {
  smsEnabled: 'Payment reminders SMS',
  emailEnabled: 'Payment reminders Email',
  signingSmsEnabled: 'E-signature SMS',
  signingEmailEnabled: 'E-signature Email',
  portalEmailEnabled: 'Portal email verification',
  portalSmsEnabled: 'Portal SMS verification',
};

/** MIS-only (enforced by the HTTP layer's `requireRole('MIS')`, not here) - matches every other system-wide toggle in this codebase. */
export class UpdateReminderSettingsUseCase {
  constructor(private readonly deps: { reminderSettingsRepository: IReminderSettingsRepository; auditLogger: IAuditLogger }) {}

  async execute(command: UpdateReminderSettingsCommand): Promise<ReminderSettings> {
    const before = await this.deps.reminderSettingsRepository.get();
    const updated = await this.deps.reminderSettingsRepository.update(command);

    // One audit entry per toggle that actually changed - not one entry for the whole PATCH - so
    // Settings > System > Activity log can show "{user} turned {toggle} on/off" per row, matching
    // how a staff member actually thinks about the action (they flipped ONE switch at a time).
    for (const field of Object.keys(TOGGLE_LABELS) as (keyof typeof TOGGLE_LABELS)[]) {
      const previousValue = before[field as keyof ReminderSettings];
      const newValue = updated[field as keyof ReminderSettings];
      if (previousValue === newValue) continue;
      await this.deps.auditLogger.log({
        userId: command.updatedByUserId,
        action: 'TOGGLE_REMINDER_SETTING',
        entityType: 'ReminderSettings',
        entityId: field,
        previousValue: { label: TOGGLE_LABELS[field], value: previousValue },
        newValue: { label: TOGGLE_LABELS[field], value: newValue },
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });
    }

    return updated;
  }
}
