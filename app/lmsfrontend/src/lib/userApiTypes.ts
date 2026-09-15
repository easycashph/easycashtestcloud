/**
 * Mirrors `app/backend`'s `UserPresenter.presentUser()` JSON shape exactly - see
 * `apiClient.ts`'s doc comment for why this pilot hand-maintains DTOs instead of generating them.
 * Never carries `passwordHash` - the presenter itself enforces that boundary.
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
  companyId: string | null;
  roleClassId: string | null;
  roleClassName: string | null;
  contactNumber: string | null;
  address: string | null;
  birthday: string | null;
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
  companyId?: string;
  roleClassId?: string;
}

/** Body for `PATCH /users/:id`. All fields optional - send only what changed. */
export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  branchId?: string;
  status?: UserStatus;
  roleNames?: string[];
  companyId?: string;
  roleClassId?: string | null;
  /** Must not already belong to another account - the backend rejects a conflicting email. */
  email?: string;
  /** MIS resetting a member's forgotten password - omit to leave the current password unchanged. */
  password?: string;
  /** 2026-09-15 (user request): MIS may now set this on another member's behalf, not just the
   * member themselves via `PATCH /users/me`. */
  contactNumber?: string | null;
}

/** Body for `PATCH /users/me` - self-service only, excludes email/status/roles/companyId. */
export interface UpdateOwnProfileRequest {
  firstName?: string;
  lastName?: string;
  contactNumber?: string | null;
  address?: string | null;
  birthday?: string | null;
}

/** Body for `POST /users/me/change-password`. */
export interface ChangeOwnPasswordRequest {
  currentPassword: string;
  newPassword: string;
}
