import type { AccessTokenClaims } from '@modules/identity/application/ports/ITokenService';
import type { PortalAccessTokenClaims } from '@modules/client-portal/application/ports/IPortalTokenService';

declare global {
  namespace Express {
    interface Request {
      /** Populated by `requireAuth` — the decoded, verified access-token claims. */
      authUser?: AccessTokenClaims;
      /** Populated by `requirePortalAuth` — the decoded, verified Easycash Portal access-token
       * claims. Deliberately a separate field from `authUser` above, never the same shape or
       * source of truth — see PORTAL_JWT_SECRET's doc comment in shared/config/env.ts. */
      portalAccount?: PortalAccessTokenClaims;
    }
  }
}

export {};
