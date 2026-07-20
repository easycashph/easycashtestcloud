import { DomainError, ValidationError, NotFoundError } from '@shared/errors/DomainError';
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

    // Proactive check (DB also enforces @@unique([roleId, name])) - gives a clean 409 instead of a
    // raw Prisma P2002 surfacing as a generic 500, same pattern as DuplicateClientProfileError.
    const existing = await this.deps.roleClassRepository.findAll();
    const duplicate = existing.some((rc) => rc.roleId === input.roleId && rc.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      throw new DomainError('DUPLICATE_ROLE_CLASS', `"${name}" already exists under ${roleType.name}.`, undefined, 409);
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
