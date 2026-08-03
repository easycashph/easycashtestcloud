import type { IChatRepository } from '../ports/IChatRepository';
import { ChatConversationNotFoundError, ChatNotClaimantError } from '../../domain/errors/ChatErrors';

export interface CancelChatTransferUseCaseDeps {
  chatRepository: IChatRepository;
}

/** Lets the initiating officer back out of a pending transfer before the recipient confirms it
 * (e.g. picked the wrong person) - 2026-07-31 user request follow-up, a safety valve for the new
 * PIN handoff flow. */
export class CancelChatTransferUseCase {
  constructor(private readonly deps: CancelChatTransferUseCaseDeps) {}

  async execute(fromUserId: string, conversationId: string): Promise<void> {
    const conversation = await this.deps.chatRepository.findConversationById(conversationId);
    if (!conversation) throw new ChatConversationNotFoundError();

    const cancelled = await this.deps.chatRepository.cancelTransfer(conversationId, fromUserId);
    if (!cancelled) throw new ChatNotClaimantError();
  }
}
