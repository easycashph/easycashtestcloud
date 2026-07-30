import { randomUUID } from 'node:crypto';
import type { ITokenService } from './ports/ITokenService';
import type { IRefreshTokenRepository } from './ports/IRefreshTokenRepository';
import type { UserRecord } from './ports/IUserRepository';
import type { TokenPairOutput } from './dtos/AuthDtos';

/**
 * The token-issuing tail shared by LoginUseCase (2FA-disabled path) and VerifyLoginOtpUseCase
 * (2FA-enabled path, once the OTP is confirmed) - both need to reach the exact same end state
 * (refresh token issued, access token signed with its `sid`), so this is factored out once rather
 * than duplicated, per CLAUDE.md's DRY principle.
 */
export async function issueTokenPair(
  deps: { tokenService: ITokenService; refreshTokenRepository: IRefreshTokenRepository; refreshTokenTtlMs: number },
  user: UserRecord,
  context: { ipAddress?: string; userAgent?: string },
): Promise<TokenPairOutput> {
  const refreshTokenExpiresAt = new Date(Date.now() + deps.refreshTokenTtlMs);
  const issued = await deps.refreshTokenRepository.issue({
    userId: user.id,
    expiresAt: refreshTokenExpiresAt,
    createdByIp: context.ipAddress,
    userAgent: context.userAgent,
  });

  const { token: accessToken, expiresAt: accessTokenExpiresAt } = deps.tokenService.signAccessToken({
    sub: user.id,
    email: user.email,
    roles: user.roles,
    branchId: user.branchId,
    jti: randomUUID(),
    sid: issued.id,
  });

  return { accessToken, accessTokenExpiresAt, refreshToken: issued.rawToken, refreshTokenExpiresAt };
}
