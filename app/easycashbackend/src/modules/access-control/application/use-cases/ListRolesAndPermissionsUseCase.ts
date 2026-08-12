import type { IAccessControlRepository, PermissionRecord, RoleWithPermissionsRecord } from '../ports/IAccessControlRepository';

export interface ListRolesAndPermissionsOutput {
  permissions: PermissionRecord[];
  roles: RoleWithPermissionsRecord[];
}

export class ListRolesAndPermissionsUseCase {
  constructor(private readonly deps: { accessControlRepository: IAccessControlRepository }) {}

  async execute(): Promise<ListRolesAndPermissionsOutput> {
    const [permissions, roles] = await Promise.all([
      this.deps.accessControlRepository.listPermissions(),
      this.deps.accessControlRepository.listRolesWithPermissions(),
    ]);
    return { permissions, roles };
  }
}
