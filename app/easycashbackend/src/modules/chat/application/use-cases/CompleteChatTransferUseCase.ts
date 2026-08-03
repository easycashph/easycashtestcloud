import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import { ValidationError } from '@shared/errors/DomainError';
import type { IChatRepository, ChatConversationRecord } from '../ports/IChatRepository';
import { ChatConversationNotClaimableError, ChatConversationNotFoundError } from '../../domain/errors/ChatErrors';

export interface CompleteChatTransferUseCaseDeps {
  userRepository: IUserRepository;
  chatRepository: IChatRepository;
}

/** The receiving officer pastes the PIN (which they can also just see/copy from their own
 * "Incoming Transfers" list - 2026-07-31 user request; this is a confirmation gesture, not a
 * secret unknown to them) to actually take over. `completeTransfer`'s atomic conditional UPDATE
 * is what actually enforces the id+recipient+PIN match - this use case only adds the SYSTEM
 * narration. */
export class CompleteChatTransferUseCase {
  constructor(private readonly deps: CompleteChatTransferUseCaseDeps) {}

  async execute(toUserId: string, conversationId: string, pin: string): Promise<ChatConversationRecord> {
    const toUser = await this.deps.userRepository.findById(toUserId);
    if (!toUser) throw new ValidationError('Staff account not found.');

    const conversation = await this.deps.chatRepository.findConversationById(conversationId);
    if (!conversation) throw new ChatConversationNotFoundError();

    const fromUserName = conversation.pendingTransferFromUserName;
    const completed = await this.deps.chatRepository.completeTransfer(conversationId, toUserId, pin);
    if (!completed) throw new ChatConversationNotClaimableError();

    await this.deps.chatRepository.addMessage({
      conversationId,
      senderType: 'SYSTEM',
      body: `${toUser.firstName} ${toUser.lastName} took over this conversation${fromUserName ? ` from ${fromUserName}` : ''}.`,
    });

    const updated = await this.deps.chatRepository.findConversationById(conversationId);
    return updated ?? conversation;
  }
}
