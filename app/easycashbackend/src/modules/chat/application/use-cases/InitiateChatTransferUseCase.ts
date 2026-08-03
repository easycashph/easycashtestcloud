import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import { ValidationError } from '@shared/errors/DomainError';
import type { IChatRepository, ChatConversationRecord } from '../ports/IChatRepository';
import { ChatConversationClosedError, ChatConversationNotFoundError, ChatNotClaimantError } from '../../domain/errors/ChatErrors';

export interface InitiateChatTransferUseCaseDeps {
  userRepository: IUserRepository;
  chatRepository: IChatRepository;
}

const PIN_PATTERN = /^\d{4}$/;

/** Redesigned transfer flow (2026-07-31 user request) - the current claimant picks ANY LMS user
 * (via Role -> Role Class -> person, resolved client-side against
 * ListChatTransferCandidatesUseCase's roster) and sets a 4-digit PIN. The claimant loses the
 * ability to send once this succeeds - the conversation is PENDING_TRANSFER until the recipient
 * confirms with the same PIN (CompleteChatTransferUseCase). */
export class InitiateChatTransferUseCase {
  constructor(private readonly deps: InitiateChatTransferUseCaseDeps) {}

  async execute(fromUserId: string, conversationId: string, toUserId: string, pin: string): Promise<ChatConversationRecord> {
    if (!PIN_PATTERN.test(pin)) {
      throw new ValidationError('PIN must be exactly 4 digits.');
    }
    if (toUserId === fromUserId) {
      throw new ValidationError('Pick someone other than yourself to transfer to.');
    }

    const fromUser = await this.deps.userRepository.findById(fromUserId);
    if (!fromUser) throw new ChatNotClaimantError();

    const toUser = await this.deps.userRepository.findById(toUserId);
    if (!toUser) throw new ValidationError('That staff member could not be found.');

    const conversation = await this.deps.chatRepository.findConversationById(conversationId);
    if (!conversation) throw new ChatConversationNotFoundError();
    if (conversation.status === 'CLOSED') throw new ChatConversationClosedError();
    if (conversation.claimedByUserId !== fromUserId) throw new ChatNotClaimantError();

    const started = await this.deps.chatRepository.initiateTransfer(conversationId, fromUserId, toUserId, pin);
    if (!started) throw new ChatNotClaimantError();

    await this.deps.chatRepository.addMessage({
      conversationId,
      senderType: 'SYSTEM',
      body: `${fromUser.firstName} ${fromUser.lastName} started transferring this conversation to ${toUser.firstName} ${toUser.lastName}.`,
    });

    const updated = await this.deps.chatRepository.findConversationById(conversationId);
    return updated ?? conversation;
  }
}
