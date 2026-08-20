import type { IChatRepository } from '../ports/IChatRepository';
import { ChatConversationNotFoundError, ChatNotClaimantError } from '../../domain/errors/ChatErrors';

export interface SetStaffChatTypingUseCaseDeps {
  chatRepository: IChatRepository;
}

/** Typing-indicator heartbeat, staff side (2026-08-20 user request) - only the current claimant's
 * typing matters to the client on the other end. */
export class SetStaffChatTypingUseCase {
  constructor(private readonly deps: SetStaffChatTypingUseCaseDeps) {}

  async execute(userId: string, conversationId: string): Promise<void> {
    const conversation = await this.deps.chatRepository.findConversationById(conversationId);
    if (!conversation) throw new ChatConversationNotFoundError();
    if (conversation.claimedByUserId !== userId) throw new ChatNotClaimantError();
    await this.deps.chatRepository.setStaffTyping(conversationId);
  }
}
