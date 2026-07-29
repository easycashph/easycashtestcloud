import type { IUserRepository } from '../ports/IUserRepository';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import type { IAuditLogger } from '../ports/IAuditLogger';
import { PasswordPolicy } from '../../domain/PasswordPolicy';
import { InvalidCredentialsError, UserNotFoundError, WeakPasswordError } from '../errors/AuthErrors';

/**
 * Self-service password change (`POST /users/me/change-password`) - requires the current
 * password, unlike `UpdateUserUseCase`'s MIS-admin reset path (which has no such check, since
 * that flow exists precisely for when a member has forgotten their password). Standard practice:
 * confirms the person changing the password is the one currently signed in, not just holding a
 * still-valid access token on a shared/unlocked machine.
 */
export interface ChangeOwnPasswordInput {
  currentPassword: string;
  newPassword: string;
}

export class ChangeOwnPasswordUseCase {
  constructor(
    private readonly deps: { userRepository: IUserRepository; passwordHasher: IPasswordHasher; auditLogger?: IAuditLogger },
  ) {}

  async execute(userId: string, input: ChangeOwnPasswordInput): Promise<void> {
    const existing = await this.deps.userRepository.findById(userId);
    if (!existing) throw new UserNotFoundError();

    const matches = await this.deps.passwordHasher.compare(input.currentPassword, existing.passwordHash);
    if (!matches) throw new InvalidCredentialsError();

    const violations = PasswordPolicy.validate(input.newPassword);
    if (violations.length > 0) throw new WeakPasswordError(violations);

    const passwordHash = await this.deps.passwordHasher.hash(input.newPassword);
    await this.deps.userRepository.update(userId, { passwordHash });

    if (this.deps.auditLogger) {
      await this.deps.auditLogger.log({
        userId,
        action: 'CHANGE_OWN_PASSWORD',
        entityType: 'User',
        entityId: userId,
      });
    }
  }
}
