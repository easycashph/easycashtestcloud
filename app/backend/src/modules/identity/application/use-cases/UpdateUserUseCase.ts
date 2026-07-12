import type { IUserRepository, UpdateUserInput, UserRecord } from '../ports/IUserRepository';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import { Email } from '../../domain/Email';
import { PasswordPolicy } from '../../domain/PasswordPolicy';
import { EmailAlreadyInUseError, UserNotFoundError, WeakPasswordError } from '../errors/AuthErrors';
import { ValidationError } from '@shared/errors/DomainError';

export interface UpdateUserUseCaseInput extends UpdateUserInput {
  /** Plaintext — MIS resetting a member's forgotten password. Hashed here, never passed through as-is. */
  password?: string;
}

export class UpdateUserUseCase {
  constructor(private readonly deps: { userRepository: IUserRepository; passwordHasher: IPasswordHasher }) {}

  async execute(id: string, patch: UpdateUserUseCaseInput): Promise<UserRecord> {
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

    return this.deps.userRepository.update(id, {
      ...rest,
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      ...(passwordHash ? { passwordHash } : {}),
    });
  }
}
