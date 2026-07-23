import type { IRefreshTokenRepository } from '../ports/IRefreshTokenRepository';
import type { RevokeSessionInput } from '../dtos/AuthDtos';
import { SessionNotFoundError } from '../errors/AuthErrors';

export interface RevokeSessionUseCaseDeps {
  refreshTokenRepository: IRefreshTokenRepository;
}

/** Settings > Security > Active Sessions (2026-07-21) - "sign out this device" for a session
 * other than the caller's own current one (the frontend disables this for `isCurrent` rows;
 * regular Logout is what ends the current session, since that also clears the browser's cookie -
 * revoking it from here would just leave a dead cookie behind). */
export class RevokeSessionUseCase {
  constructor(private readonly deps: RevokeSessionUseCaseDeps) {}

  async execute(input: RevokeSessionInput): Promise<void> {
    const { refreshTokenRepository } = this.deps;
    const session = await refreshTokenRepository.findById(input.sessionId);
    // Same error for "doesn't exist" and "isn't yours" - never lets a caller distinguish the two
    // by probing ids (see SessionNotFoundError's doc comment).
    if (!session || session.userId !== input.userId) {
      throw new SessionNotFoundError();
    }
    // Idempotent: already-revoked/expired is treated as success, not an error - same posture as
    // LogoutUseCase for the "double-click revoke" / stale-list race.
    await refreshTokenRepository.revoke(session.id);
  }
}
