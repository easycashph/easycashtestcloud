import type { FindManyUsersOptions, IUserRepository, UserRecord } from '../ports/IUserRepository';

export class ListUsersUseCase {
  constructor(private readonly deps: { userRepository: IUserRepository }) {}

  async execute(options: FindManyUsersOptions): Promise<UserRecord[]> {
    return this.deps.userRepository.findMany(options);
  }
}
