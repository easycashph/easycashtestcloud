import type { PermissionRecord, RoleWithPermissionsRecord } from '../../../application/ports/IAccessControlRepository';

export interface PermissionHTTPResponse {
  id: string;
  code: string;
  description: string | null;
}

export interface RoleWithPermissionsHTTPResponse {
  id: string;
  name: string;
  userCount: number;
  permissionCodes: string[];
}

export function presentPermission(permission: PermissionRecord): PermissionHTTPResponse {
  return { id: permission.id, code: permission.code, description: permission.description };
}

export function presentRoleWithPermissions(role: RoleWithPermissionsRecord): RoleWithPermissionsHTTPResponse {
  return { id: role.id, name: role.name, userCount: role.userCount, permissionCodes: role.permissionCodes };
}
