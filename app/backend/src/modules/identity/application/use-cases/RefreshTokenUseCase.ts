import { randomUUID } from 'node:crypto';
import type { IUserRepository } from '../ports/IUserRepository';
import type { ITokenService } from '../ports/ITokenService';
import type { IRefreshTokenRepository } from '../ports/IRefreshTokenRepository';
import type { RefreshInput, RefreshOutput } from '../dtos/AuthDtos';
import { TokenNotFoundError, TokenExpiredError, TokenReuseDetectedError, UserInactiveError } from '../errors/AuthErrors';

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
 * Order of checks matters: not-found -> already-revoked (reuse -> revoke
 * ALL of the user's tokens defensively, then throw) -> expired -> user
 * status re-checked live (a refresh token issued while a user was ACTIVE
 * must not still work after the account is deactivated) -> rotate.
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
      // TXN-1-adjacent integrity principle applied to sessions: an
      // already-rotated token being presented again is a theft signal,
      // not a routine error. Revoke the whole session family.
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

    // Rotate: revoke the presented token, issue a brand-new pair.
    await refreshTokenRepository.revoke(existing.id);

    const { token: accessToken, expiresAt: accessTokenExpiresAt } = tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      roles: user.roles,
      branchId: user.branchId,
      jti: randomUUID(),
    });

    const refreshTokenExpiresAt = new Date(Date.now() + (this.deps.refreshTokenTtlMs ?? REFRESH_TOKEN_TTL_MS));
    const { rawToken: refreshToken } = await refreshTokenRepository.issue({
      userId: user.id,
      expiresAt: refreshTokenExpiresAt,
    });

    return { accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt };
  }
}
