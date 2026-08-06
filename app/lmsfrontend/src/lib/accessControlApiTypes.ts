/** Mirrors `AccessControlPresenter.ts` in app/easycashbackend exactly. */
export interface Permission {
  id: string;
  code: string;
  description: string | null;
}

export interface RoleWithPermissions {
  id: string;
  name: string;
  userCount: number;
  permissionCodes: string[];
}

export interface ListRolesAndPermissionsResponse {
  permissions: Permission[];
  roles: RoleWithPermissions[];
}
