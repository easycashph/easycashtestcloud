import type { IUserRepository, UpdateUserInput, UserRecord } from '../ports/IUserRepository';
import { UserNotFoundError } from '../errors/AuthErrors';

export class UpdateUserUseCase {
  constructor(private readonly deps: { userRepository: IUserRepository }) {}

  async execute(id: string, patch: UpdateUserInput): Promise<UserRecord> {
    const existing = await this.deps.userRepository.findById(id);
    if (!existing) {
      throw new UserNotFoundError();
    }
    return this.deps.userRepository.update(id, patch);
  }
}
