import type { IChatRepository, ChatConversationRecord } from '../ports/IChatRepository';

export interface ListIncomingChatTransfersUseCaseDeps {
  chatRepository: IChatRepository;
}

/** Conversations another officer has started transferring to this user, awaiting their PIN
 * confirmation (2026-07-31 user request). The PIN itself is included here - the recipient is
 * exactly who it's meant to be visible to. */
export class ListIncomingChatTransfersUseCase {
  constructor(private readonly deps: ListIncomingChatTransfersUseCaseDeps) {}

  execute(userId: string): Promise<ChatConversationRecord[]> {
    return this.deps.chatRepository.listIncomingTransfersForUser(userId);
  }
}
