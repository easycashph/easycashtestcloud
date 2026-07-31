import type { IUserRepository } from '../ports/IUserRepository';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import type { ITokenService } from '../ports/ITokenService';
import type { IRefreshTokenRepository } from '../ports/IRefreshTokenRepository';
import type { IAuditLogger } from '../ports/IAuditLogger';
import type { ITwoFactorChallengeRepository } from '../ports/ITwoFactorChallengeRepository';
import type { ITrustedDeviceRepository } from '../ports/ITrustedDeviceRepository';
import type { IOtpSender } from '../ports/IOtpSender';
import type { LoginInput, LoginResult } from '../dtos/AuthDtos';
import { InvalidCredentialsError, AccountInactiveError } from '../errors/AuthErrors';
import { issueTokenPair } from '../authTokenIssuance';

// Fallback only — the real value is env.JWT_REFRESH_TTL_MS, wired in by the
// composition root (app.ts). This constant exists purely so unit tests that
// construct this use case directly (without full app wiring) still get a
// sane default (Milestone 6 audit finding H-01).
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Settings > Security > Two-Factor Authentication (2026-07-22) - how long a LOGIN-purpose OTP
 * challenge stays valid. Same value used by RequestTwoFactorSetupUseCase for ENABLE challenges. */
export const OTP_CHALLENGE_TTL_MS = 5 * 60 * 1000;

export interface LoginUseCaseDeps {
  userRepository: IUserRepository;
  passwordHasher: IPasswordHasher;
  tokenService: ITokenService;
  refreshTokenRepository: IRefreshTokenRepository;
  auditLogger: IAuditLogger;
  twoFactorChallengeRepository: ITwoFactorChallengeRepository;
  trustedDeviceRepository: ITrustedDeviceRepository;
  otpSender: IOtpSender;
  refreshTokenTtlMs?: number;
}

/**
 * Milestone 6 plan §6.1. Business rules: user must exist AND
 * status = ACTIVE AND password must match. Unknown-email and
 * wrong-password both resolve to the SAME InvalidCredentialsError
 * (timing/enumeration mitigation, §4) — never branch the response on
 * which case occurred.
 *
 * 2026-07-22 (Two-Factor Authentication, user request): once credentials check out, a
 * `twoFactorEnabled` account gets a LOGIN-purpose OTP challenge instead of tokens — the real
 * token issuance moves to VerifyLoginOtpUseCase, which the caller must complete next. Nothing
 * about the credentials-checking logic above changes; only what happens after they pass.
 */
export class LoginUseCase {
  constructor(private readonly deps: LoginUseCaseDeps) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const {
      userRepository,
      passwordHasher,
      tokenService,
      refreshTokenRepository,
      auditLogger,
      twoFactorChallengeRepository,
      trustedDeviceRepository,
      otpSender,
    } = this.deps;

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

    // "Remember this device" (2026-07-30 user request) - a valid, unexpired trusted-device token
    // skips the 2FA challenge entirely, same as if twoFactorEnabled were false. Checked ownership
    // (record.userId === user.id) so one account's device token can never skip 2FA for another.
    const trustedDevice = input.deviceToken ? await trustedDeviceRepository.findValidByRawToken(input.deviceToken) : null;
    const skip2fa = trustedDevice?.userId === user.id;

    if (user.twoFactorEnabled && user.twoFactorChannel && !skip2fa) {
      const destination = user.twoFactorChannel === 'EMAIL' ? user.email : (user.contactNumber ?? user.email);
      const { id: challengeId, code } = await twoFactorChallengeRepository.create({
        userId: user.id,
        purpose: 'LOGIN',
        channel: user.twoFactorChannel,
        expiresAt: new Date(Date.now() + OTP_CHALLENGE_TTL_MS),
      });
      await otpSender.send(user.twoFactorChannel, destination, code);
      // Not LOGIN_SUCCESS yet — credentials passed, but the session isn't established until
      // VerifyLoginOtpUseCase completes. No audit entry at all here, same as a normal login
      // mid-flow generates none until the tail below.
      return { twoFactorRequired: true, challengeId, channel: user.twoFactorChannel };
    }

    const tokens = await issueTokenPair(
      { tokenService, refreshTokenRepository, refreshTokenTtlMs: this.deps.refreshTokenTtlMs ?? REFRESH_TOKEN_TTL_MS },
      user,
      { ipAddress: input.ipAddress, userAgent: input.userAgent },
    );

    await auditLogger.log({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      ...tokens,
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
        twoFactorEnabled: user.twoFactorEnabled,
        twoFactorChannel: user.twoFactorChannel,
      },
    };
  }
}
