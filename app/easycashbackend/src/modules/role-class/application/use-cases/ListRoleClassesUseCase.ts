import type { RoleClass } from '../../domain/RoleClass';
import type { IRoleClassRepository, RoleTypeRecord } from '../ports/IRoleClassRepository';

export interface ListRoleClassesOutput {
  roleTypes: RoleTypeRecord[];
  roleClasses: RoleClass[];
}

export class ListRoleClassesUseCase {
  constructor(private readonly deps: { roleClassRepository: IRoleClassRepository }) {}

  async execute(): Promise<ListRoleClassesOutput> {
    const [roleTypes, roleClasses] = await Promise.all([
      this.deps.roleClassRepository.findAllRoleTypes(),
      this.deps.roleClassRepository.findAll(),
    ]);
    return { roleTypes, roleClasses };
  }
}
