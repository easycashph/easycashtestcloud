import type { IRefreshTokenRepository } from '../ports/IRefreshTokenRepository';
import type { LogoutAllInput, LogoutAllOutput } from '../dtos/AuthDtos';

export interface LogoutAllUseCaseDeps {
  refreshTokenRepository: IRefreshTokenRepository;
}

/** Milestone 6 plan §6.4 — "sign out everywhere." Requires a valid access token (§5). */
export class LogoutAllUseCase {
  constructor(private readonly deps: LogoutAllUseCaseDeps) {}

  async execute(input: LogoutAllInput): Promise<LogoutAllOutput> {
    const revokedCount = await this.deps.refreshTokenRepository.revokeAllForUser(input.userId);
    return { revokedCount };
  }
}
