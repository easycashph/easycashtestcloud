import type { IRefreshTokenRepository } from '../ports/IRefreshTokenRepository';
import type { ListSessionsInput, SessionView } from '../dtos/AuthDtos';

export interface ListSessionsUseCaseDeps {
  refreshTokenRepository: IRefreshTokenRepository;
}

/** Settings > Security > Active Sessions (2026-07-21) - every currently logged-in device for the
 * requesting user, newest first, with the caller's own device flagged `isCurrent`. */
export class ListSessionsUseCase {
  constructor(private readonly deps: ListSessionsUseCaseDeps) {}

  async execute(input: ListSessionsInput): Promise<SessionView[]> {
    const sessions = await this.deps.refreshTokenRepository.listActiveByUser(input.userId);
    return sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      ipAddress: s.createdByIp,
      userAgent: s.userAgent,
      isCurrent: s.id === input.currentSessionId,
    }));
  }
}
