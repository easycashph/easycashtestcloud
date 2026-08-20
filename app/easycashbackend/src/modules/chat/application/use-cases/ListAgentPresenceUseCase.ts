import type { ChatAgentPresenceRecord, IChatRepository } from '../ports/IChatRepository';

export interface ListAgentPresenceUseCaseDeps {
  chatRepository: IChatRepository;
}

export class ListAgentPresenceUseCase {
  constructor(private readonly deps: ListAgentPresenceUseCaseDeps) {}

  async execute(): Promise<ChatAgentPresenceRecord[]> {
    return this.deps.chatRepository.listAgentPresence();
  }
}
