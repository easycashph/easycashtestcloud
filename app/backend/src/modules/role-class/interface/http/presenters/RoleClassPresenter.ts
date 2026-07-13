import type { RoleClass } from '../../../domain/RoleClass';

export interface RoleClassHTTPResponse {
  id: string;
  roleId: string;
  roleName: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export function presentRoleClass(roleClass: RoleClass): RoleClassHTTPResponse {
  const props = roleClass.toProps();
  return {
    id: props.id,
    roleId: props.roleId,
    roleName: props.roleName,
    name: props.name,
    createdAt: props.createdAt.toISOString(),
    updatedAt: props.updatedAt.toISOString(),
  };
}
