/**
 * Mirrors `app/backend/src/modules/identity/application/dtos/AuthDtos.ts`'s `AuthenticatedUserView`
 * and the auth endpoints' JSON response shapes. Kept as a small, hand-maintained mirror (not
 * generated) - see `apiClient.ts`'s own doc comment for why this pilot isn't using codegen yet.
 */
export interface AuthenticatedUserView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  branchId: string;
  roles: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  contactNumber: string | null;
  address: string | null;
  birthday: string | null;
}

export interface LoginResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: AuthenticatedUserView;
}

export interface RefreshResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
}

/** Settings > Security > Active Sessions (2026-07-21) - `GET /auth/sessions` item shape. Mirrors
 * `AuthDtos.ts`'s `SessionView`. */
export interface SessionView {
  id: string;
  createdAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
}

/** Settings > Security > Recent Sign-in Activity (2026-07-21) - `GET /audit-logs/my-login-activity`
 * item shape. Mirrors the backend's `LoginActivityResponse`. */
export interface LoginActivityView {
  id: string;
  action: 'LOGIN_SUCCESS' | 'LOGIN_FAILED';
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}
