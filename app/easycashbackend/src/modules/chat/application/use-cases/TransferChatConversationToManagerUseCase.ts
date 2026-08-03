import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import type { IChatRepository } from '../ports/IChatRepository';
import { ChatConversationNotFoundError, ChatNotClaimantError } from '../../domain/errors/ChatErrors';

export interface TransferChatConversationToManagerUseCaseDeps {
  userRepository: IUserRepository;
  chatRepository: IChatRepository;
}

/** Only the staff member who currently has the conversation claimed can hand it off - matches the
 * call-center "transfer to a supervisor" flow the user asked for. Puts it back in the queue,
 * unclaimed, visible only to manager-eligible staff (see ChatEligibility.ts) - the SAME claim
 * mechanism then decides who picks it up next, not a direct assignment to a specific person. */
export class TransferChatConversationToManagerUseCase {
  constructor(private readonly deps: TransferChatConversationToManagerUseCaseDeps) {}

  async execute(userId: string, conversationId: string): Promise<void> {
    const user = await this.deps.userRepository.findById(userId);
    if (!user) throw new ChatNotClaimantError();

    const conversation = await this.deps.chatRepository.findConversationById(conversationId);
    if (!conversation) throw new ChatConversationNotFoundError();
    if (conversation.claimedByUserId !== userId) throw new ChatNotClaimantError();

    await this.deps.chatRepository.addMessage({
      conversationId,
      senderType: 'SYSTEM',
      body: `${user.firstName} ${user.lastName} transferred this conversation to a manager.`,
    });
    await this.deps.chatRepository.transferToManager(conversationId);
  }
}
