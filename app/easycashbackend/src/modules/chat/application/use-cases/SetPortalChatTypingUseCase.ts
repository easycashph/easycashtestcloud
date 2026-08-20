import type { IChatRepository } from '../ports/IChatRepository';
import { ChatConversationNotFoundError } from '../../domain/errors/ChatErrors';

export interface SetPortalChatTypingUseCaseDeps {
  chatRepository: IChatRepository;
}

/** Typing-indicator heartbeat, client side (2026-08-20 user request) - see the Prisma model's own
 * doc comment for why this is a timestamp, not a boolean. */
export class SetPortalChatTypingUseCase {
  constructor(private readonly deps: SetPortalChatTypingUseCaseDeps) {}

  async execute(portalAccountId: string, conversationId: string): Promise<void> {
    const conversation = await this.deps.chatRepository.findConversationById(conversationId);
    if (!conversation || conversation.portalAccountId !== portalAccountId) {
      throw new ChatConversationNotFoundError();
    }
    await this.deps.chatRepository.setPortalTyping(conversationId);
  }
}
