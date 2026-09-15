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
  companyId: string | null;
  roleClassId: string | null;
  roleClassName: string | null;
  contactNumber: string | null;
  address: string | null;
  birthday: string | null;
  twoFactorEnabled: boolean;
  twoFactorChannel: 'EMAIL' | 'SMS' | null;
  createdAt: string;
  updatedAt: string;
  /** 2026-09-15: see UserRecord.lastActiveAt's doc comment - a session-backed "online" signal, only
   * accurate on responses that came from ListUsersUseCase/GetUserUseCase (findMany/findById). */
  lastActiveAt: string | null;
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
    companyId: record.companyId,
    roleClassId: record.roleClassId,
    roleClassName: record.roleClassName,
    contactNumber: record.contactNumber,
    address: record.address,
    birthday: record.birthday ? record.birthday.toISOString() : null,
    twoFactorEnabled: record.twoFactorEnabled,
    twoFactorChannel: record.twoFactorChannel,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    lastActiveAt: record.lastActiveAt ? record.lastActiveAt.toISOString() : null,
  };
}
