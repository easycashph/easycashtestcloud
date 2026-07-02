/**
 * Plain application-layer shape for a user record — deliberately NOT the
 * Prisma-generated `User` type, so `application/` stays framework-free and
 * isn't coupled to the database column set (Clean Architecture: ports are
 * defined by the layer that needs them, implemented by infrastructure).
 */
export interface UserRecord {
  id: string;
  branchId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  roles: string[];
}

export interface CreateUserInput {
  branchId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  roleNames: string[];
}

export interface IUserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: CreateUserInput): Promise<UserRecord>;
  hasAnyUserWithRole(roleName: string): Promise<boolean>;
}
