import { ValidationError, NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import type { RoleClass } from '../../domain/RoleClass';
import type { IRoleClassRepository } from '../ports/IRoleClassRepository';

export class UpdateRoleClassUseCase {
  constructor(private readonly deps: { roleClassRepository: IRoleClassRepository; auditLogger?: IAuditLogger }) {}

  async execute(id: string, name: string, updatedByUserId?: string): Promise<RoleClass> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new ValidationError('Role Class name is required.');
    }

    const existing = await this.deps.roleClassRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('RoleClass', id);
    }

    const updated = await this.deps.roleClassRepository.update(id, { name: trimmedName });

    if (this.deps.auditLogger && updatedByUserId) {
      await this.deps.auditLogger.log({
        userId: updatedByUserId,
        action: 'UPDATE_ROLE_CLASS',
        entityType: 'RoleClass',
        entityId: id,
        previousValue: { name: existing.name },
        newValue: { name: updated.name },
      });
    }

    return updated;
  }
}
