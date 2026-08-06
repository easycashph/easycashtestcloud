export interface PermissionRecord {
  id: string;
  code: string;
  description: string | null;
}

export interface RoleWithPermissionsRecord {
  id: string;
  name: string;
  userCount: number;
  permissionCodes: string[];
}

export interface IAccessControlRepository {
  listPermissions(): Promise<PermissionRecord[]>;
  listRolesWithPermissions(): Promise<RoleWithPermissionsRecord[]>;
  /** Replaces the given role's ENTIRE granted-permission set with exactly `permissionCodes` (add missing, remove anything not listed) — the UI always sends the full desired state, not a diff. */
  setRolePermissions(roleId: string, permissionCodes: string[]): Promise<RoleWithPermissionsRecord>;
}
