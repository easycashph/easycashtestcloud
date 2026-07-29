export interface RoleType {
  id: string;
  name: string;
}

export interface RoleClass {
  id: string;
  roleId: string;
  roleName: string;
  name: string;
  /** How many staff accounts currently hold this Role Class - a Role Class with a count above 0 cannot be deleted. */
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListRoleClassesResponse {
  roleTypes: RoleType[];
  roleClasses: RoleClass[];
}
