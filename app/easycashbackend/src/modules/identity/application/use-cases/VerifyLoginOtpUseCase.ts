import type { IUserRepository } from '../ports/IUserRepository';
import type { ITokenService } from '../ports/ITokenService';
import type { IRefreshTokenRepository } from '../ports/IRefreshTokenRepository';
import type { IAuditLogger } from '../ports/IAuditLogger';
import type { ITwoFactorChallengeRepository } from '../ports/ITwoFactorChallengeRepository';
import type { ITrustedDeviceRepository } from '../ports/ITrustedDeviceRepository';
import type { LoginOutput, VerifyLoginOtpInput } from '../dtos/AuthDtos';
import type { IPermissionCodesRepository } from '../ports/IPermissionCodesRepository';
import type { ISecuritySettingsRepository } from '@modules/security-settings/application/ports/ISecuritySettingsRepository';
import { InvalidOtpError, TooManyOtpAttemptsError, UserInactiveError } from '../errors/AuthErrors';
import { issueTokenPair } from '../authTokenIssuance';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
/** "Remember this device" (2026-07-30 user request) - how long a trusted-device token skips 2FA. */
const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface VerifyLoginOtpUseCaseDeps {
  userRepository: IUserRepository;
  tokenService: ITokenService;
  refreshTokenRepository: IRefreshTokenRepository;
  auditLogger: IAuditLogger;
  twoFactorChallengeRepository: ITwoFactorChallengeRepository;
  trustedDeviceRepository: ITrustedDeviceRepository;
  permissionCodesRepository: IPermissionCodesRepository;
  securitySettingsRepository: ISecuritySettingsRepository;
  refreshTokenTtlMs?: number;
}

/**
 * Settings > Security > Two-Factor Authentication (2026-07-22) - completes a login that
 * LoginUseCase paused on `twoFactorRequired`. Mirrors LoginUseCase's own tail (issueTokenPair +
 * LOGIN_SUCCESS audit entry) exactly, since from the caller's perspective this IS "finishing the
 * login," just with an extra step in between.
 */
export class VerifyLoginOtpUseCase {
  constructor(private readonly deps: VerifyLoginOtpUseCaseDeps) {}

  async execute(input: VerifyLoginOtpInput): Promise<LoginOutput> {
    const {
      userRepository,
      tokenService,
      refreshTokenRepository,
      auditLogger,
      twoFactorChallengeRepository,
      trustedDeviceRepository,
      permissionCodesRepository,
      securitySettingsRepository,
    } = this.deps;

    const challenge = await twoFactorChallengeRepository.findById(input.challengeId);
    // Same InvalidOtpError for "doesn't exist," "wrong purpose," "already consumed," and
    // "expired" - never lets a caller distinguish which one occurred (see InvalidOtpError's doc
    // comment).
    if (!challenge || challenge.purpose !== 'LOGIN' || challenge.consumedAt || challenge.expiresAt.getTime() < Date.now()) {
      throw new InvalidOtpError();
    }
    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      throw new TooManyOtpAttemptsError();
    }

    const consumed = await twoFactorChallengeRepository.verifyAndConsume(challenge.id, input.code);
    if (!consumed) {
      await twoFactorChallengeRepository.incrementAttempts(challenge.id);
      await auditLogger.log({
        userId: challenge.userId,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: challenge.userId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
      throw new InvalidOtpError();
    }

    const user = await userRepository.findById(challenge.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UserInactiveError();
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

    const deviceToken = input.rememberDevice
      ? (await trustedDeviceRepository.issue({ userId: user.id, expiresAt: new Date(Date.now() + TRUSTED_DEVICE_TTL_MS) })).rawToken
      : undefined;

    const permissionCodes = await permissionCodesRepository.getGrantedPermissionCodes(user.roles);
    const securitySettings = await securitySettingsRepository.get();

    return {
      ...tokens,
      ...(deviceToken ? { deviceToken } : {}),
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
        twoFactorSetupRequired: securitySettings.enforceTwoFactorForAllUsers && !user.twoFactorEnabled,
        permissionCodes,
      },
    };
  }
}
