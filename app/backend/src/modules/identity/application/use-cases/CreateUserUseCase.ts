import type { IUserRepository, UserRecord } from '../ports/IUserRepository';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import { Email } from '../../domain/Email';
import { PasswordPolicy } from '../../domain/PasswordPolicy';
import { EmailAlreadyInUseError, WeakPasswordError } from '../errors/AuthErrors';
import { ValidationError } from '@shared/errors/DomainError';

export interface CreateUserUseCaseInput {
  branchId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roleNames: string[];
}

/** Same sequence as scripts/create-additional-mis-user.ts, now reusable from HTTP: validate email → duplicate check → password policy → hash → create. */
export class CreateUserUseCase {
  constructor(private readonly deps: { userRepository: IUserRepository; passwordHasher: IPasswordHasher }) {}

  async execute(input: CreateUserUseCaseInput): Promise<UserRecord> {
    const emailObj = Email.create(input.email);
    if (!emailObj) {
      throw new ValidationError('Invalid email address.');
    }
    const email = emailObj.toString();

    const existing = await this.deps.userRepository.findByEmail(email);
    if (existing) {
      throw new EmailAlreadyInUseError(email);
    }

    const violations = PasswordPolicy.validate(input.password);
    if (violations.length > 0) {
      throw new WeakPasswordError(violations);
    }

    const passwordHash = await this.deps.passwordHasher.hash(input.password);

    return this.deps.userRepository.create({
      branchId: input.branchId,
      email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      roleNames: input.roleNames,
    });
  }
}
