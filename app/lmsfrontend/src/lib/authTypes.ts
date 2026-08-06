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
  /** Settings > Security > Two-Factor Authentication (2026-07-22). */
  twoFactorEnabled: boolean;
  twoFactorChannel: 'EMAIL' | 'SMS' | null;
  /** 2026-08-06 (Roles & Permissions feature): the union of every Permission.code granted to any
   * of `roles` above, right now - see the backend DTO's own doc comment. */
  permissionCodes: string[];
}

export interface LoginSuccessResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: AuthenticatedUserView;
  /** "Remember this device" (2026-07-30 user request) - present only when the staff member checked
   * the box on the OTP step and a new trusted-device token was just issued. */
  deviceToken?: string;
}

/** Settings > Security > Two-Factor Authentication (2026-07-22) - `POST /auth/login`'s other
 * possible result for a 2FA-enabled account: no tokens yet, just enough to show the OTP entry
 * step. Complete the login with `POST /auth/verify-login-otp` (see `LoginPage.tsx`). */
export interface TwoFactorRequiredResponse {
  twoFactorRequired: true;
  challengeId: string;
  channel: 'EMAIL' | 'SMS';
}

export type LoginResponse = LoginSuccessResponse | TwoFactorRequiredResponse;

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
