export interface LoginInput {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
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
