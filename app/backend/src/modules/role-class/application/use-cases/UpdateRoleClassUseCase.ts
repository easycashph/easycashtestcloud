import { ValidationError, NotFoundError } from '@shared/errors/DomainError';
import type { RoleClass } from '../../domain/RoleClass';
import type { IRoleClassRepository } from '../ports/IRoleClassRepository';

export class UpdateRoleClassUseCase {
  constructor(private readonly deps: { roleClassRepository: IRoleClassRepository }) {}

  async execute(id: string, name: string): Promise<RoleClass> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new ValidationError('Role Class name is required.');
    }

    const existing = await this.deps.roleClassRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('RoleClass', id);
    }

    return this.deps.roleClassRepository.update(id, { name: trimmedName });
  }
}
