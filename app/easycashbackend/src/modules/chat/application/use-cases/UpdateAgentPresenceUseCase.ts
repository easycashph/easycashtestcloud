import { ValidationError } from '@shared/errors/DomainError';
import type { ChatAgentStatus, IChatRepository } from '../ports/IChatRepository';

export interface UpdateAgentPresenceUseCaseDeps {
  chatRepository: IChatRepository;
}

const VALID_STATUSES = new Set<ChatAgentStatus>(['ONLINE', 'AWAY', 'OFFLINE']);

/** Staff presence (2026-08-20 user request, BPO-style support) - explicit status the agent sets
 * themselves (Online/Away/Offline), plus the LMS chat page's own heartbeat re-sends the current
 * status periodically while the page stays open so it degrades to a stale "Online" only after a
 * tab is genuinely closed/idle for a while - the frontend, not this use case, owns that timing. */
export class UpdateAgentPresenceUseCase {
  constructor(private readonly deps: UpdateAgentPresenceUseCaseDeps) {}

  async execute(userId: string, status: string): Promise<void> {
    if (!VALID_STATUSES.has(status as ChatAgentStatus)) {
      throw new ValidationError(`Invalid status "${status}".`);
    }
    await this.deps.chatRepository.upsertAgentPresence(userId, status as ChatAgentStatus);
  }
}
