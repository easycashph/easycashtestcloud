import type { IUserRepository } from '../ports/IUserRepository';
import type { IPermissionCodesRepository } from '../ports/IPermissionCodesRepository';
import type { AuthenticatedUserView, GetCurrentUserInput } from '../dtos/AuthDtos';
import { UserNotFoundError, UserInactiveError } from '../errors/AuthErrors';
import type { ISecuritySettingsRepository } from '@modules/security-settings/application/ports/ISecuritySettingsRepository';

export interface GetCurrentUserUseCaseDeps {
  userRepository: IUserRepository;
  permissionCodesRepository: IPermissionCodesRepository;
  securitySettingsRepository: ISecuritySettingsRepository;
}

/**
 * Milestone 6 plan §6.5: re-fetches from the database rather than trusting
 * the decoded access-token claims, so a since-deactivated account or
 * changed roles are reflected immediately rather than only after the
 * access token's 15-minute TTL naturally expires.
 */
export class GetCurrentUserUseCase {
  constructor(private readonly deps: GetCurrentUserUseCaseDeps) {}

  async execute(input: GetCurrentUserInput): Promise<AuthenticatedUserView> {
    const user = await this.deps.userRepository.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }
    if (user.status !== 'ACTIVE') {
      throw new UserInactiveError();
    }

    const permissionCodes = await this.deps.permissionCodesRepository.getGrantedPermissionCodes(user.roles);
    const securitySettings = await this.deps.securitySettingsRepository.get();

    return {
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
    };
  }
}
