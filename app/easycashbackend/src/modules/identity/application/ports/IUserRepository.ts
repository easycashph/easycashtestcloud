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
  companyId: string | null;
  roleClassId: string | null;
  roleClassName: string | null;
  contactNumber: string | null;
  address: string | null;
  birthday: Date | null;
  /** Settings > Security > Two-Factor Authentication (2026-07-22). `twoFactorChannel` is null
   * until 2FA is first enabled. */
  twoFactorEnabled: boolean;
  twoFactorChannel: 'EMAIL' | 'SMS' | null;
  createdAt: Date;
  updatedAt: Date;
  /** 2026-09-15 (user request, "naka-online ba ang user"): most recent RefreshToken.createdAt for
   * this user - each refresh rotates the token (see RefreshTokenUseCase's doc comment: revoke old +
   * issue new), so this IS effectively "last time this user's browser tab silently refreshed its
   * session," which happens roughly every access-token-TTL-minus-safety-margin interval (~14 min
   * today) while a tab stays open - a real, session-backed "online" signal, not a self-reported one
   * like the Chat module's separate agent presence. Only `findMany`/`findById` populate this with a
   * real value (a batched query, not per-row N+1); every other IUserRepository method returns
   * `null` here since presence isn't needed on those paths (login, create, update, notification
   * recipient resolution) - `null` from those callers means "not computed," not "never logged in." */
  lastActiveAt: Date | null;
}

export interface CreateUserInput {
  branchId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  roleNames: string[];
  companyId?: string;
  roleClassId?: string;
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
  companyId?: string;
  roleClassId?: string | null;
  /** Already normalized/validated — set by UpdateUserUseCase after the uniqueness check. */
  email?: string;
  /** Already-hashed — set by UpdateUserUseCase/ChangeOwnPasswordUseCase. Never plaintext at this layer. */
  passwordHash?: string;
  /** Self-service fields — set by UpdateOwnProfileUseCase. */
  contactNumber?: string | null;
  address?: string | null;
  birthday?: Date | null;
  /** Set together by ConfirmTwoFactorSetupUseCase (enabling) and DisableTwoFactorUseCase
   * (disabling, both fields reset to false/null). */
  twoFactorEnabled?: boolean;
  twoFactorChannel?: 'EMAIL' | 'SMS' | null;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  findMany(options: FindManyUsersOptions): Promise<UserRecord[]>;
  create(input: CreateUserInput): Promise<UserRecord>;
  update(id: string, patch: UpdateUserInput): Promise<UserRecord>;
  hasAnyUserWithRole(roleName: string): Promise<boolean>;
  /** ACTIVE users holding any of `roleNames`, scoped to `branchId` OR holding a global role (`MIS`
   * - see `GLOBAL_ROLES` in `shared/http/branchScope.ts`) regardless of their own branch. Added
   * 2026-07-17 for the Notification Center's recipient resolution (e.g. "notify every MIS/Loan
   * Operation Manager/CRM at this application's branch"). */
  findByRolesAndBranch(roleNames: string[], branchId: string): Promise<UserRecord[]>;
  /** ACTIVE users holding any of `roleNames`, across EVERY branch - not scoped to one branch's
   * loans/applications, unlike `findByRolesAndBranch` above. Added 2026-09-03 for notification
   * types that aren't naturally tied to a single branch (e.g. Portal chat, which has no branchId
   * of its own at all - see `ChatConversationRecord`). Each returned user's own `branchId` is used
   * to satisfy `Notification.branchId`'s required FK when the notification is created for them. */
  findByRoles(roleNames: string[]): Promise<UserRecord[]>;
}
