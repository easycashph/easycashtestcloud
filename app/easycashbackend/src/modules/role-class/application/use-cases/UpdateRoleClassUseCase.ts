import { DomainError, ValidationError, NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import type { RoleClass } from '../../domain/RoleClass';
import type { IRoleClassRepository } from '../ports/IRoleClassRepository';

export interface UpdateRoleClassInput {
  name?: string;
  /** Reassigns this Role Class to a different Role Type (2026-07-20) - e.g. correcting one that
   * was set up under the wrong Role Type. Existing staff already holding this Role Class keep it -
   * their `roleClassId` is unaffected, only the label's own parent Role Type changes. */
  roleId?: string;
}

export class UpdateRoleClassUseCase {
  constructor(private readonly deps: { roleClassRepository: IRoleClassRepository; auditLogger?: IAuditLogger }) {}

  async execute(id: string, input: UpdateRoleClassInput, updatedByUserId?: string): Promise<RoleClass> {
    const existing = await this.deps.roleClassRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('RoleClass', id);
    }

    let trimmedName: string | undefined;
    if (input.name !== undefined) {
      trimmedName = input.name.trim();
      if (!trimmedName) {
        throw new ValidationError('Role Class name is required.');
      }
    }

    const targetRoleId = input.roleId ?? existing.roleId;
    if (input.roleId !== undefined) {
      const roleTypes = await this.deps.roleClassRepository.findAllRoleTypes();
      if (!roleTypes.some((r) => r.id === input.roleId)) {
        throw new NotFoundError('Role', input.roleId);
      }
    }

    const nameToCheck = trimmedName ?? existing.name;
    if (input.name !== undefined || input.roleId !== undefined) {
      const all = await this.deps.roleClassRepository.findAll();
      const duplicate = all.some(
        (rc) => rc.id !== id && rc.roleId === targetRoleId && rc.name.toLowerCase() === nameToCheck.toLowerCase(),
      );
      if (duplicate) {
        throw new DomainError('DUPLICATE_ROLE_CLASS', `"${nameToCheck}" already exists under that Role Type.`, undefined, 409);
      }
    }

    const updated = await this.deps.roleClassRepository.update(id, {
      ...(trimmedName !== undefined ? { name: trimmedName } : {}),
      ...(input.roleId !== undefined ? { roleId: input.roleId } : {}),
    });

    if (this.deps.auditLogger && updatedByUserId) {
      await this.deps.auditLogger.log({
        userId: updatedByUserId,
        action: 'UPDATE_ROLE_CLASS',
        entityType: 'RoleClass',
        entityId: id,
        previousValue: { name: existing.name, roleId: existing.roleId },
        newValue: { name: updated.name, roleId: updated.roleId },
      });
    }

    return updated;
  }
}
