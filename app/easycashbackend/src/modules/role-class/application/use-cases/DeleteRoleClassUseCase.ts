import { DomainError, NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import type { IRoleClassRepository } from '../ports/IRoleClassRepository';

/**
 * 2026-07-20 user request. `User.roleClassId` is nullable with `onDelete: SetNull` at the DB level,
 * so a raw delete would silently blank out the job title of every staff account still holding this
 * Role Class - blocked here instead, same "never silently change existing functionality" principle
 * as everywhere else. MIS must reassign those staff to a different Role Class first (Edit Member).
 */
export class DeleteRoleClassUseCase {
  constructor(private readonly deps: { roleClassRepository: IRoleClassRepository; auditLogger?: IAuditLogger }) {}

  async execute(id: string, deletedByUserId?: string): Promise<void> {
    const existing = await this.deps.roleClassRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('RoleClass', id);
    }

    if (existing.userCount > 0) {
      throw new DomainError(
        'ROLE_CLASS_IN_USE',
        `Cannot delete "${existing.name}" - ${existing.userCount} staff account(s) are still assigned to it. Reassign them to a different Role Class first.`,
        undefined,
        409,
      );
    }

    await this.deps.roleClassRepository.delete(id);

    if (this.deps.auditLogger && deletedByUserId) {
      await this.deps.auditLogger.log({
        userId: deletedByUserId,
        action: 'DELETE_ROLE_CLASS',
        entityType: 'RoleClass',
        entityId: id,
        previousValue: { name: existing.name, roleType: existing.roleName },
      });
    }
  }
}
