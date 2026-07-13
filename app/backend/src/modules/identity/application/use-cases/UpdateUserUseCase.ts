import type { IUserRepository, UpdateUserInput, UserRecord } from '../ports/IUserRepository';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import type { IAuditLogger } from '../ports/IAuditLogger';
import { Email } from '../../domain/Email';
import { PasswordPolicy } from '../../domain/PasswordPolicy';
import { EmailAlreadyInUseError, UserNotFoundError, WeakPasswordError } from '../errors/AuthErrors';
import { ValidationError } from '@shared/errors/DomainError';

export interface UpdateUserUseCaseInput extends UpdateUserInput {
  /** Plaintext — MIS resetting a member's forgotten password. Hashed here, never passed through as-is. */
  password?: string;
}

export class UpdateUserUseCase {
  constructor(
    private readonly deps: { userRepository: IUserRepository; passwordHasher: IPasswordHasher; auditLogger?: IAuditLogger },
  ) {}

  async execute(id: string, patch: UpdateUserUseCaseInput, updatedByUserId?: string): Promise<UserRecord> {
    const existing = await this.deps.userRepository.findById(id);
    if (!existing) {
      throw new UserNotFoundError();
    }

    const { password, email, ...rest } = patch;

    let normalizedEmail: string | undefined;
    if (email !== undefined) {
      const emailObj = Email.create(email);
      if (!emailObj) {
        throw new ValidationError('Invalid email address.');
      }
      normalizedEmail = emailObj.toString();
      if (normalizedEmail !== existing.email) {
        const conflict = await this.deps.userRepository.findByEmail(normalizedEmail);
        if (conflict && conflict.id !== id) {
          throw new EmailAlreadyInUseError(normalizedEmail);
        }
      }
    }

    let passwordHash: string | undefined;
    if (password) {
      const violations = PasswordPolicy.validate(password);
      if (violations.length > 0) {
        throw new WeakPasswordError(violations);
      }
      passwordHash = await this.deps.passwordHasher.hash(password);
    }

    const updated = await this.deps.userRepository.update(id, {
      ...rest,
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      ...(passwordHash ? { passwordHash } : {}),
    });

    if (this.deps.auditLogger && updatedByUserId) {
      const action = rest.status === 'INACTIVE' && existing.status !== 'INACTIVE' ? 'DELETE_MEMBER' : 'UPDATE_MEMBER';
      await this.deps.auditLogger.log({
        userId: updatedByUserId,
        action,
        entityType: 'User',
        entityId: id,
        previousValue: { status: existing.status, email: existing.email, roles: existing.roles },
        newValue: { status: updated.status, email: updated.email, roles: updated.roles, passwordReset: Boolean(passwordHash) },
      });
    }

    return updated;
  }
}
