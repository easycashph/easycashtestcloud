import { ValidationError, NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import type { RoleClass } from '../../domain/RoleClass';
import type { IRoleClassRepository } from '../ports/IRoleClassRepository';

export interface CreateRoleClassInput {
  roleId: string;
  name: string;
}

export class CreateRoleClassUseCase {
  constructor(private readonly deps: { roleClassRepository: IRoleClassRepository; auditLogger?: IAuditLogger }) {}

  async execute(input: CreateRoleClassInput, createdByUserId?: string): Promise<RoleClass> {
    const name = input.name.trim();
    if (!name) {
      throw new ValidationError('Role Class name is required.');
    }

    const roleTypes = await this.deps.roleClassRepository.findAllRoleTypes();
    const roleType = roleTypes.find((r) => r.id === input.roleId);
    if (!roleType) {
      throw new NotFoundError('Role', input.roleId);
    }

    const roleClass = await this.deps.roleClassRepository.create({ roleId: input.roleId, name });

    if (this.deps.auditLogger && createdByUserId) {
      await this.deps.auditLogger.log({
        userId: createdByUserId,
        action: 'CREATE_ROLE_CLASS',
        entityType: 'RoleClass',
        entityId: roleClass.id,
        newValue: { roleType: roleType.name, name },
      });
    }

    return roleClass;
  }
}
