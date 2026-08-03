import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import type { IChatRepository } from '../ports/IChatRepository';
import { ChatConversationNotFoundError, ChatNotClaimantError } from '../../domain/errors/ChatErrors';

export interface CloseChatConversationUseCaseDeps {
  userRepository: IUserRepository;
  chatRepository: IChatRepository;
}

export class CloseChatConversationUseCase {
  constructor(private readonly deps: CloseChatConversationUseCaseDeps) {}

  async execute(userId: string, conversationId: string): Promise<void> {
    const user = await this.deps.userRepository.findById(userId);
    if (!user) throw new ChatNotClaimantError();

    const conversation = await this.deps.chatRepository.findConversationById(conversationId);
    if (!conversation) throw new ChatConversationNotFoundError();
    if (conversation.claimedByUserId !== userId) throw new ChatNotClaimantError();

    await this.deps.chatRepository.addMessage({
      conversationId,
      senderType: 'SYSTEM',
      body: `${user.firstName} ${user.lastName} closed this conversation.`,
    });
    await this.deps.chatRepository.closeConversation(conversationId);
  }
}
