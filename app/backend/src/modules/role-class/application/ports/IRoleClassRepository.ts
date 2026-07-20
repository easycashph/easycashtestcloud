import type { RoleClass } from '../../domain/RoleClass';

export interface RoleTypeRecord {
  id: string;
  name: string;
}

export interface CreateRoleClassInput {
  roleId: string;
  name: string;
}

export interface UpdateRoleClassInput {
  name?: string;
  roleId?: string;
}

export interface IRoleClassRepository {
  /** The fixed set of Role Types (existing `roles` table - MIS, Loan Operation Manager, CRM, Finance, Accounting, Collection Officer). */
  findAllRoleTypes(): Promise<RoleTypeRecord[]>;
  findAll(): Promise<RoleClass[]>;
  findById(id: string): Promise<RoleClass | null>;
  create(input: CreateRoleClassInput): Promise<RoleClass>;
  update(id: string, input: UpdateRoleClassInput): Promise<RoleClass>;
  /** Guarded by the use case, not the repository - callers must confirm `userCount === 0` first. */
  delete(id: string): Promise<void>;
}
