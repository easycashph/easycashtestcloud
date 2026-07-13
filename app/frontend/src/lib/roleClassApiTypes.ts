export interface RoleType {
  id: string;
  name: string;
}

export interface RoleClass {
  id: string;
  roleId: string;
  roleName: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListRoleClassesResponse {
  roleTypes: RoleType[];
  roleClasses: RoleClass[];
}
