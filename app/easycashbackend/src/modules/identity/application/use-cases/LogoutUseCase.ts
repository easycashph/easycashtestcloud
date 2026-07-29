import type { IRefreshTokenRepository } from '../ports/IRefreshTokenRepository';
import type { LogoutInput } from '../dtos/AuthDtos';

export interface LogoutUseCaseDeps {
  refreshTokenRepository: IRefreshTokenRepository;
}

/**
 * Milestone 6 plan §6.3: idempotent, never throws. A missing or already-
 * revoked token is treated as "already logged out," not an error — the
 * controller always clears the cookie and returns 204 regardless.
 */
export class LogoutUseCase {
  constructor(private readonly deps: LogoutUseCaseDeps) {}

  async execute(input: LogoutInput): Promise<void> {
    if (!input.rawRefreshToken) {
      return;
    }
    const existing = await this.deps.refreshTokenRepository.findByRawToken(input.rawRefreshToken);
    if (existing && !existing.revokedAt) {
      await this.deps.refreshTokenRepository.revoke(existing.id);
    }
  }
}
