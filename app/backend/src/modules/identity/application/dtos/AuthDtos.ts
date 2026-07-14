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
