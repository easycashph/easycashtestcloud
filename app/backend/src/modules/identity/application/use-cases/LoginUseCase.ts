import type { IUserRepository } from '../ports/IUserRepository';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import type { ITokenService } from '../ports/ITokenService';
import type { IRefreshTokenRepository } from '../ports/IRefreshTokenRepository';
import type { IAuditLogger } from '../ports/IAuditLogger';
import type { LoginInput, LoginOutput } from '../dtos/AuthDtos';
import { InvalidCredentialsError, AccountInactiveError } from '../errors/AuthErrors';
import { randomUUID } from 'node:crypto';

// Fallback only — the real value is env.JWT_REFRESH_TTL_MS, wired in by the
// composition root (app.ts). This constant exists purely so unit tests that
// construct this use case directly (without full app wiring) still get a
// sane default (Milestone 6 audit finding H-01).
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface LoginUseCaseDeps {
  userRepository: IUserRepository;
  passwordHasher: IPasswordHasher;
  tokenService: ITokenService;
  refreshTokenRepository: IRefreshTokenRepository;
  auditLogger: IAuditLogger;
  refreshTokenTtlMs?: number;
}

/**
 * Milestone 6 plan §6.1. Business rules: user must exist AND
 * status = ACTIVE AND password must match. Unknown-email and
 * wrong-password both resolve to the SAME InvalidCredentialsError
 * (timing/enumeration mitigation, §4) — never branch the response on
 * which case occurred.
 */
export class LoginUseCase {
  constructor(private readonly deps: LoginUseCaseDeps) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const { userRepository, passwordHasher, tokenService, refreshTokenRepository, auditLogger } = this.deps;

    const user = await userRepository.findByEmail(input.email);

    // Always run a bcrypt comparison, even for an unknown email, against a
    // fixed dummy hash — keeps response timing indistinguishable from the
    // wrong-password case (Milestone 6 plan §4, timing-attack mitigation).
    const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO0Ku4CU9jGkxN.zn.b3F2hAtBcqfNjGO';
    const passwordMatches = await passwordHasher.compare(input.password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !passwordMatches) {
      await auditLogger.log({
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user?.id ?? 'unknown',
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
      throw new InvalidCredentialsError();
    }

    if (user.status !== 'ACTIVE') {
      await auditLogger.log({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
      throw new AccountInactiveError();
    }

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
      createdByIp: input.ipAddress,
    });

    await auditLogger.log({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
      refreshTokenExpiresAt,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        branchId: user.branchId,
        roles: user.roles,
        status: user.status,
        contactNumber: user.contactNumber,
        address: user.address,
        birthday: user.birthday ? user.birthday.toISOString() : null,
      },
    };
  }
}
