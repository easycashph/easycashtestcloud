export interface PortalAccessTokenClaims {
  sub: string;
  email: string;
}

export interface SignedPortalAccessToken {
  token: string;
  expiresAt: Date;
}

/** Deliberately a separate port/implementation from identity's ITokenService - signs with
 * PORTAL_JWT_SECRET, never JWT_ACCESS_SECRET, so a portal token can never verify against the
 * staff-side requireAuth middleware or vice versa. See PORTAL_JWT_SECRET's doc comment in
 * shared/config/env.ts. */
export interface IPortalTokenService {
  signAccessToken(claims: PortalAccessTokenClaims): SignedPortalAccessToken;
  verifyAccessToken(token: string): PortalAccessTokenClaims | null;
}
