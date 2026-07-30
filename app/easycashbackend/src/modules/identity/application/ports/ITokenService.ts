export interface AccessTokenClaims {
  sub: string;
  email: string;
  roles: string[];
  branchId: string;
  jti: string;
  /** The current RefreshToken row's id (Settings > Security > Active Sessions, 2026-07-21) - lets
   * the sessions list mark "this device" without the access token ever carrying the raw refresh
   * secret itself. Set at login/refresh time from IssuedRefreshToken.id. */
  sid: string;
}

export interface SignedAccessToken {
  token: string;
  expiresAt: Date;
}

/**
 * Milestone 6 plan §3: access tokens are short-lived, stateless, signed
 * JWTs (HS256). Refresh tokens are deliberately NOT JWTs — see
 * IRefreshTokenRepository — so this port only covers access tokens.
 */
export interface ITokenService {
  signAccessToken(claims: AccessTokenClaims): SignedAccessToken;
  verifyAccessToken(token: string): AccessTokenClaims | null;
}
