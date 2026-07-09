/**
 * Mirrors `app/backend`'s `UserPresenter.presentUser()` JSON shape exactly — see
 * `apiClient.ts`'s doc comment for why this pilot hand-maintains DTOs instead of generating them.
 * Never carries `passwordHash` — the presenter itself enforces that boundary.
 */
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  branchId: string;
  branchName: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: UserStatus;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

/** Body for `POST /users`. */
export interface CreateUserRequest {
  branchId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roleNames: string[];
}

/** Body for `PATCH /users/:id`. All fields optional — send only what changed. */
export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  branchId?: string;
  status?: UserStatus;
  roleNames?: string[];
}
