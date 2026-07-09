import type { UserRecord } from '../../../application/ports/IUserRepository';

export interface UserResponse {
  id: string;
  branchId: string;
  branchName: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

/** Never include passwordHash — presenters are the one enforced boundary between UserRecord and the wire. */
export function presentUser(record: UserRecord): UserResponse {
  return {
    id: record.id,
    branchId: record.branchId,
    branchName: record.branchName,
    email: record.email,
    firstName: record.firstName,
    lastName: record.lastName,
    fullName: `${record.firstName} ${record.lastName}`,
    status: record.status,
    roles: record.roles,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
