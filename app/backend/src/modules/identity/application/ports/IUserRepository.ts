/**
 * Plain application-layer shape for a user record — deliberately NOT the
 * Prisma-generated `User` type, so `application/` stays framework-free and
 * isn't coupled to the database column set (Clean Architecture: ports are
 * defined by the layer that needs them, implemented by infrastructure).
 */
export interface UserRecord {
  id: string;
  branchId: string;
  branchName: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  branchId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  roleNames: string[];
}

export interface FindManyUsersOptions {
  limit: number;
  cursor?: string;
  /** Case-insensitive match against firstName/lastName/email. */
  search?: string;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  branchId?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  roleNames?: string[];
}

export interface IUserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  findMany(options: FindManyUsersOptions): Promise<UserRecord[]>;
  create(input: CreateUserInput): Promise<UserRecord>;
  update(id: string, patch: UpdateUserInput): Promise<UserRecord>;
  hasAnyUserWithRole(roleName: string): Promise<boolean>;
}
