import type { IChatRepository, ChatConversationRecord } from '../ports/IChatRepository';

export interface ListMyClaimedChatConversationsUseCaseDeps {
  chatRepository: IChatRepository;
}

/** Backs the LMS's "My Chats" list - every conversation currently claimed by this staff member. */
export class ListMyClaimedChatConversationsUseCase {
  constructor(private readonly deps: ListMyClaimedChatConversationsUseCaseDeps) {}

  execute(userId: string): Promise<ChatConversationRecord[]> {
    return this.deps.chatRepository.listClaimedConversationsForUser(userId);
  }
}
