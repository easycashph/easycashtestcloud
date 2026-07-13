import type { IUserRepository } from '../ports/IUserRepository';
import type { AuthenticatedUserView, GetCurrentUserInput } from '../dtos/AuthDtos';
import { UserNotFoundError, UserInactiveError } from '../errors/AuthErrors';

export interface GetCurrentUserUseCaseDeps {
  userRepository: IUserRepository;
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
    };
  }
}
