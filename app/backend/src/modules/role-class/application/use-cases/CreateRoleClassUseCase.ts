import { ValidationError, NotFoundError } from '@shared/errors/DomainError';
import type { RoleClass } from '../../domain/RoleClass';
import type { IRoleClassRepository } from '../ports/IRoleClassRepository';

export interface CreateRoleClassInput {
  roleId: string;
  name: string;
}

export class CreateRoleClassUseCase {
  constructor(private readonly deps: { roleClassRepository: IRoleClassRepository }) {}

  async execute(input: CreateRoleClassInput): Promise<RoleClass> {
    const name = input.name.trim();
    if (!name) {
      throw new ValidationError('Role Class name is required.');
    }

    const roleTypes = await this.deps.roleClassRepository.findAllRoleTypes();
    if (!roleTypes.some((r) => r.id === input.roleId)) {
      throw new NotFoundError('Role', input.roleId);
    }

    return this.deps.roleClassRepository.create({ roleId: input.roleId, name });
  }
}
