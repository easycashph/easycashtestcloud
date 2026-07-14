import type { IUserRepository, UserRecord } from '../ports/IUserRepository';
import { UserNotFoundError } from '../errors/AuthErrors';

/**
 * Self-service profile update (`PATCH /users/me`) - deliberately narrower than
 * `UpdateUserUseCase` (the MIS-only admin path): only fields a staff member may change about
 * themselves without oversight. Email, status, roles, and companyId stay MIS-controlled via
 * `PATCH /users/:id` - changing your own email/role/status here would let a user silently
 * escalate access or lock themselves out in a way MIS never approved.
 */
export interface UpdateOwnProfileInput {
  firstName?: string;
  lastName?: string;
  contactNumber?: string | null;
  address?: string | null;
  birthday?: Date | null;
}

export class UpdateOwnProfileUseCase {
  constructor(private readonly deps: { userRepository: IUserRepository }) {}

  async execute(userId: string, input: UpdateOwnProfileInput): Promise<UserRecord> {
    const existing = await this.deps.userRepository.findById(userId);
    if (!existing) throw new UserNotFoundError();

    return this.deps.userRepository.update(userId, {
      firstName: input.firstName,
      lastName: input.lastName,
      contactNumber: input.contactNumber,
      address: input.address,
      birthday: input.birthday,
    });
  }
}
