import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import type { IChatRepository, ChatConversationRecord, ChatMessageRecord } from '../ports/IChatRepository';
import { canClaimManagerConversations, canClaimNewConversations } from '../../domain/ChatEligibility';
import { ChatConversationNotFoundError, ChatNotEligibleError } from '../../domain/errors/ChatErrors';

export interface GetChatConversationForStaffUseCaseDeps {
  userRepository: IUserRepository;
  chatRepository: IChatRepository;
}

export interface StaffChatView {
  conversation: ChatConversationRecord;
  messages: ChatMessageRecord[];
}

/** A staff member can view a conversation's messages if they're the current (or, once closed,
 * former) claimant, or if it's still WAITING and they're eligible to claim it - a preview before
 * committing, same as a call center agent seeing the queue entry's context before answering. */
export class GetChatConversationForStaffUseCase {
  constructor(private readonly deps: GetChatConversationForStaffUseCaseDeps) {}

  async execute(userId: string, conversationId: string): Promise<StaffChatView> {
    const user = await this.deps.userRepository.findById(userId);
    if (!user) throw new ChatNotEligibleError();

    const conversation = await this.deps.chatRepository.findConversationById(conversationId);
    if (!conversation) throw new ChatConversationNotFoundError();

    const isClaimant = conversation.claimedByUserId === userId;
    if (!isClaimant) {
      if (conversation.status !== 'WAITING') throw new ChatNotEligibleError();
      const eligibilityUser = { roles: user.roles, roleClassName: user.roleClassName };
      const eligible = conversation.requiresManager
        ? canClaimManagerConversations(eligibilityUser)
        : canClaimNewConversations(eligibilityUser);
      if (!eligible) throw new ChatNotEligibleError();
    }

    const messages = await this.deps.chatRepository.listMessages(conversationId);
    return { conversation, messages };
  }
}
