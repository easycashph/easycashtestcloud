import type { AccessTokenClaims } from '@modules/identity/application/ports/ITokenService';

declare global {
  namespace Express {
    interface Request {
      /** Populated by `requireAuth` — the decoded, verified access-token claims. */
      authUser?: AccessTokenClaims;
    }
  }
}

export {};
