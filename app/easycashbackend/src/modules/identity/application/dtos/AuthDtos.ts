export interface LoginInput {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
  /** "Remember this device" (2026-07-30 user request) - if this matches a valid, unexpired
   * TrustedDevice for the account, the 2FA challenge is skipped entirely, same as if
   * `twoFactorEnabled` were false. */
  deviceToken?: string;
}

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
}

export interface TokenPairOutput {
  accessToken: string;
  accessTokenExpiresAt: Date;
  /** Raw refresh token — the controller places this in an HttpOnly cookie, never in the JSON body. */
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface LoginOutput extends TokenPairOutput {
  user: AuthenticatedUserView;
  /** "Remember this device" (2026-07-30) - present only when VerifyLoginOtpUseCase just issued a
   * new TrustedDevice (the caller checked the box); the frontend stores this and resends it as
   * `LoginInput.deviceToken` on future logins. Never present on a plain (non-2FA) login. */
  deviceToken?: string;
}

/** Settings > Security > Two-Factor Authentication (2026-07-22) - LoginUseCase's alternate
 * "credentials were correct, but an OTP is needed before any token is issued" result. No
 * accessToken/refreshToken here at all - the caller must complete VerifyLoginOtpUseCase first. */
export interface TwoFactorRequiredOutput {
  twoFactorRequired: true;
  challengeId: string;
  channel: 'EMAIL' | 'SMS';
}

export type LoginResult = LoginOutput | TwoFactorRequiredOutput;

export interface VerifyLoginOtpInput {
  challengeId: string;
  code: string;
  ipAddress?: string;
  userAgent?: string;
  /** "Remember this device" (2026-07-30) - the checkbox on the OTP step. */
  rememberDevice?: boolean;
}

export interface RequestTwoFactorSetupInput {
  userId: string;
  channel: 'EMAIL' | 'SMS';
}

export interface RequestTwoFactorSetupOutput {
  challengeId: string;
}

export interface ConfirmTwoFactorSetupInput {
  userId: string;
  challengeId: string;
  code: string;
}

export interface DisableTwoFactorInput {
  userId: string;
  currentPassword: string;
}

export interface RefreshInput {
  rawRefreshToken: string;
  /** Re-captured on every refresh - carries the current request's IP/User-Agent forward onto the
   * rotated row (Settings > Security > Active Sessions, 2026-07-21), so the displayed "last seen"
   * IP/device for a long-lived session reflects recent activity, not just the original login. */
  ipAddress?: string;
  userAgent?: string;
}

export type RefreshOutput = TokenPairOutput;

export interface LogoutInput {
  rawRefreshToken?: string;
}

export interface LogoutAllInput {
  userId: string;
}

export interface LogoutAllOutput {
  revokedCount: number;
}

export interface GetCurrentUserInput {
  userId: string;
}

/** Settings > Security > Active Sessions (2026-07-21). */
export interface ListSessionsInput {
  userId: string;
  /** The requesting access token's own `sid` claim - flags that row `isCurrent` in the output so
   * the UI can show "This device" and disable revoking it (revoke that one via regular Logout
   * instead, which also clears the cookie - see SessionsCard's doc comment on the frontend). */
  currentSessionId: string;
}

export interface SessionView {
  id: string;
  createdAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
}

export interface RevokeSessionInput {
  userId: string;
  sessionId: string;
}

/** Forgot Password (2026-07-28). Mirrors the client-portal module's RequestPasswordReset/
 * ConfirmPasswordReset DTOs exactly - same enumeration-avoidance shape (see
 * RequestPasswordResetOutput below). */
export interface RequestPasswordResetInput {
  email: string;
}

export interface RequestPasswordResetOutput {
  /** Always returned, even when the email doesn't match any active user - a caller must never be
   * able to tell "no such account" apart from "code sent" by inspecting this response (same
   * enumeration-avoidance posture as InvalidCredentialsError elsewhere in this module). Only a
   * real, active user's code is ever actually sent/usable. */
  challengeId: string;
}

export interface ConfirmPasswordResetInput {
  challengeId: string;
  code: string;
  newPassword: string;
}
