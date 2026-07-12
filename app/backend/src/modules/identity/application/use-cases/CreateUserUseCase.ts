import type { IUserRepository, UserRecord } from '../ports/IUserRepository';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import type { IAuditLogger } from '../ports/IAuditLogger';
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
  companyId?: string;
  roleClassId?: string;
}

/** Same sequence as scripts/create-additional-mis-user.ts, now reusable from HTTP: validate email → duplicate check → password policy → hash → create. */
export class CreateUserUseCase {
  constructor(private readonly deps: { userRepository: IUserRepository; passwordHasher: IPasswordHasher; auditLogger?: IAuditLogger }) {}

  async execute(input: CreateUserUseCaseInput, createdByUserId?: string): Promise<UserRecord> {
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

    const user = await this.deps.userRepository.create({
      branchId: input.branchId,
      email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      roleNames: input.roleNames,
      companyId: input.companyId,
      roleClassId: input.roleClassId,
    });

    if (this.deps.auditLogger && createdByUserId) {
      await this.deps.auditLogger.log({
        userId: createdByUserId,
        action: 'CREATE_MEMBER',
        entityType: 'User',
        entityId: user.id,
        newValue: { email: user.email, roles: user.roles },
      });
    }

    return user;
  }
}
