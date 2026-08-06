import { NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import type { IAccessControlRepository, RoleWithPermissionsRecord } from '../ports/IAccessControlRepository';

export interface UpdateRolePermissionsCommand {
  roleId: string;
  permissionCodes: string[];
  updatedByUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * MIS-only (enforced by the HTTP layer's `requireRole('MIS')`, not here) — matches every other
 * system-wide configuration screen in this codebase (reminder-settings, role-class, loan-product).
 *
 * One audit entry per permission that actually changed (granted or revoked), not one entry for
 * the whole save — same "{user} flipped {one thing}" convention `UpdateReminderSettingsUseCase`
 * already established, so Settings > System > Activity Logs reads as a list of individual
 * decisions ("MIS granted Collection Officer: Record Payment"), not one opaque bulk diff.
 */
export class UpdateRolePermissionsUseCase {
  constructor(private readonly deps: { accessControlRepository: IAccessControlRepository; auditLogger: IAuditLogger }) {}

  async execute(command: UpdateRolePermissionsCommand): Promise<RoleWithPermissionsRecord> {
    const roles = await this.deps.accessControlRepository.listRolesWithPermissions();
    const before = roles.find((r) => r.id === command.roleId);
    if (!before) {
      throw new NotFoundError('Role', command.roleId);
    }

    const updated = await this.deps.accessControlRepository.setRolePermissions(command.roleId, command.permissionCodes);

    const beforeSet = new Set(before.permissionCodes);
    const afterSet = new Set(updated.permissionCodes);
    const granted = updated.permissionCodes.filter((code) => !beforeSet.has(code));
    const revoked = before.permissionCodes.filter((code) => !afterSet.has(code));

    for (const code of granted) {
      await this.deps.auditLogger.log({
        userId: command.updatedByUserId,
        action: 'GRANT_ROLE_PERMISSION',
        entityType: 'Role',
        entityId: command.roleId,
        previousValue: { role: before.name, permission: code, granted: false },
        newValue: { role: before.name, permission: code, granted: true },
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });
    }
    for (const code of revoked) {
      await this.deps.auditLogger.log({
        userId: command.updatedByUserId,
        action: 'REVOKE_ROLE_PERMISSION',
        entityType: 'Role',
        entityId: command.roleId,
        previousValue: { role: before.name, permission: code, granted: true },
        newValue: { role: before.name, permission: code, granted: false },
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });
    }

    return updated;
  }
}
