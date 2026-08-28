import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import type { ISecuritySettingsRepository, SecuritySettings } from '../ports/ISecuritySettingsRepository';

export interface UpdateSecuritySettingsCommand {
  enforceTwoFactorForAllUsers?: boolean;
  updatedByUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

/** field key -> human label, used for the Settings > System > Activity log panel, matching
 * UpdateReminderSettingsUseCase's own pattern. */
const TOGGLE_LABELS: Record<string, string> = {
  enforceTwoFactorForAllUsers: 'Require 2FA for all users',
};

/** MIS-only (enforced by the HTTP layer's `requirePermission`, not here) - matches every other
 * system-wide toggle in this codebase (see UpdateReminderSettingsUseCase). */
export class UpdateSecuritySettingsUseCase {
  constructor(private readonly deps: { securitySettingsRepository: ISecuritySettingsRepository; auditLogger: IAuditLogger }) {}

  async execute(command: UpdateSecuritySettingsCommand): Promise<SecuritySettings> {
    const before = await this.deps.securitySettingsRepository.get();
    const updated = await this.deps.securitySettingsRepository.update(command);

    for (const field of Object.keys(TOGGLE_LABELS) as (keyof typeof TOGGLE_LABELS)[]) {
      const previousValue = before[field as keyof SecuritySettings];
      const newValue = updated[field as keyof SecuritySettings];
      if (previousValue === newValue) continue;
      await this.deps.auditLogger.log({
        userId: command.updatedByUserId,
        action: 'TOGGLE_SECURITY_SETTING',
        entityType: 'SecuritySettings',
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
