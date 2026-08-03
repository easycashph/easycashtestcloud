import type { IChatRepository, ChatConversationRecord } from '../ports/IChatRepository';

export interface ListMyClaimedChatConversationsUseCaseDeps {
  chatRepository: IChatRepository;
}

/** Backs the LMS's "My Chats" list (2026-07-31 user request, transfer redesign) - every
 * conversation currently claimed by this staff member (actionable), PLUS every conversation they
 * were ever the ORIGINAL claimant on, even after transferring it away (read-only history - "hindi
 * na dapat makapag-chat si loan officer, makikita na lang niya"). The frontend tells these apart
 * by comparing `claimedByUserId` against its own user id. */
export class ListMyClaimedChatConversationsUseCase {
  constructor(private readonly deps: ListMyClaimedChatConversationsUseCaseDeps) {}

  execute(userId: string): Promise<ChatConversationRecord[]> {
    return this.deps.chatRepository.listConversationsForUserHistory(userId);
  }
}
