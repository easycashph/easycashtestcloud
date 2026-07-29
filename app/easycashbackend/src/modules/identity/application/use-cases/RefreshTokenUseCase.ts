import { randomUUID } from 'node:crypto';
import type { IUserRepository } from '../ports/IUserRepository';
import type { ITokenService } from '../ports/ITokenService';
import type { IRefreshTokenRepository } from '../ports/IRefreshTokenRepository';
import type { RefreshInput, RefreshOutput } from '../dtos/AuthDtos';
import { TokenNotFoundError, TokenExpiredError, TokenReuseDetectedError, UserInactiveError } from '../errors/AuthErrors';

// Fallback only — the real value is env.JWT_REFRESH_TTL_MS, wired in by the
// composition root (app.ts). This constant exists purely so unit tests that
// construct this use case directly (without full app wiring) still get a
// sane default (Milestone 6 audit finding H-01).
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface RefreshTokenUseCaseDeps {
  userRepository: IUserRepository;
  tokenService: ITokenService;
  refreshTokenRepository: IRefreshTokenRepository;
  refreshTokenTtlMs?: number;
}

/**
 * Milestone 6 plan §3/§6.2: rotate-on-use with reuse detection.
 *
 * Production-readiness review revision: expiry and user-status are now
 * checked BEFORE attempting to rotate, using only the already-fetched
 * `existing` record and a plain `findById` — no DB writes happen for a
 * request that's going to be rejected anyway. This is safe with no new
 * race window: if a token is expired or its user inactive, ALL concurrent
 * requests presenting it independently reach the same rejection (no writes
 * occur on this path either way, so there's nothing for two racers to
 * disagree about).
 *
 * The actual rotation — revoke old + issue new — is delegated to
 * `IRefreshTokenRepository.rotate()`, a single atomic, transactional
 * operation (see that port's doc comment). This use case never calls
 * `revoke()` and `issue()` separately for the rotation path: doing so
 * would reopen the exact "orphaned session on partial failure" gap this
 * revision closes, and would also require re-implementing the atomic
 * claim/race-detection logic here instead of once in the repository.
 */
export class RefreshTokenUseCase {
  constructor(private readonly deps: RefreshTokenUseCaseDeps) {}

  async execute(input: RefreshInput): Promise<RefreshOutput> {
    const { userRepository, tokenService, refreshTokenRepository } = this.deps;

    const existing = await refreshTokenRepository.findByRawToken(input.rawRefreshToken);
    if (!existing) {
      throw new TokenNotFoundError();
    }

    if (existing.revokedAt) {
      // Already known-revoked from this read alone — a theft/reuse signal,
      // not a routine error. Revoke the whole session family defensively.
      await refreshTokenRepository.revokeAllForUser(existing.userId);
      throw new TokenReuseDetectedError();
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new TokenExpiredError();
    }

    const user = await userRepository.findById(existing.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UserInactiveError();
    }

    const refreshTokenExpiresAt = new Date(Date.now() + (this.deps.refreshTokenTtlMs ?? REFRESH_TOKEN_TTL_MS));
    const rotated = await refreshTokenRepository.rotate(existing.id, {
      userId: user.id,
      expiresAt: refreshTokenExpiresAt,
      createdByIp: input.ipAddress,
      userAgent: input.userAgent,
    });

    if (!rotated) {
      // Lost the atomic claim: a concurrent request rotated this exact
      // token between our read above and this call — the concurrent-reuse
      // race that C-01 exists to catch.
      await refreshTokenRepository.revokeAllForUser(existing.userId);
      throw new TokenReuseDetectedError();
    }

    const { token: accessToken, expiresAt: accessTokenExpiresAt } = tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      roles: user.roles,
      branchId: user.branchId,
      jti: randomUUID(),
      sid: rotated.id,
    });

    return { accessToken, accessTokenExpiresAt, refreshToken: rotated.rawToken, refreshTokenExpiresAt };
  }
}
