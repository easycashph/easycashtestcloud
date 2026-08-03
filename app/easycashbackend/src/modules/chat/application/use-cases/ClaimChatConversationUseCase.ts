import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import type { IChatRepository, ChatConversationRecord } from '../ports/IChatRepository';
import { canClaimManagerConversations, canClaimNewConversations } from '../../domain/ChatEligibility';
import { ChatConversationNotClaimableError, ChatConversationNotFoundError, ChatNotEligibleError } from '../../domain/errors/ChatErrors';

export interface ClaimChatConversationUseCaseDeps {
  userRepository: IUserRepository;
  chatRepository: IChatRepository;
}

/** "First loan officer to click" claims the conversation exclusively (2026-07-31 user request,
 * explicitly modeled on a call center's claim queue) - `IChatRepository.claimConversation`'s
 * atomic conditional UPDATE is what actually decides the race; this use case only adds the
 * eligibility check and the SYSTEM narration message. */
export class ClaimChatConversationUseCase {
  constructor(private readonly deps: ClaimChatConversationUseCaseDeps) {}

  async execute(userId: string, conversationId: string): Promise<ChatConversationRecord> {
    const user = await this.deps.userRepository.findById(userId);
    if (!user) throw new ChatNotEligibleError();

    const conversation = await this.deps.chatRepository.findConversationById(conversationId);
    if (!conversation || conversation.status !== 'WAITING') throw new ChatConversationNotFoundError();

    const eligibilityUser = { roles: user.roles, roleClassName: user.roleClassName };
    const eligible = conversation.requiresManager
      ? canClaimManagerConversations(eligibilityUser)
      : canClaimNewConversations(eligibilityUser);
    if (!eligible) throw new ChatNotEligibleError();

    const claimed = await this.deps.chatRepository.claimConversation(conversationId, userId);
    if (!claimed) throw new ChatConversationNotClaimableError();

    await this.deps.chatRepository.addMessage({
      conversationId,
      senderType: 'SYSTEM',
      body: `${user.firstName} ${user.lastName} joined the conversation.`,
    });

    const updated = await this.deps.chatRepository.findConversationById(conversationId);
    return updated ?? conversation;
  }
}
