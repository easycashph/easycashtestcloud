import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import type { IChatRepository, ChatConversationRecord, ChatMessageRecord } from '../ports/IChatRepository';
import { canClaimNewConversations } from '../../domain/ChatEligibility';
import { ChatConversationNotFoundError, ChatNotEligibleError } from '../../domain/errors/ChatErrors';

export interface GetChatConversationForStaffUseCaseDeps {
  userRepository: IUserRepository;
  chatRepository: IChatRepository;
}

export interface StaffChatView {
  conversation: ChatConversationRecord;
  messages: ChatMessageRecord[];
  /** True once viewer can no longer send here (not the current claimant) - the history/read-only
   * case (2026-07-31 user request): the original claimant keeps seeing a conversation they've
   * since transferred away, but can't chat in it anymore. */
  isReadOnly: boolean;
}

/** A staff member can view a conversation's messages if they're the current claimant, EVER a
 * participant on it (read-only history, even after transferring it away - 2026-07-31 user
 * request, and now covering every hop of the chain via ChatConversationParticipant - 2026-08-03
 * user request), the pending-transfer sender/recipient, or (still WAITING) an eligible staff
 * member previewing before claiming. */
export class GetChatConversationForStaffUseCase {
  constructor(private readonly deps: GetChatConversationForStaffUseCaseDeps) {}

  async execute(userId: string, conversationId: string): Promise<StaffChatView> {
    const user = await this.deps.userRepository.findById(userId);
    if (!user) throw new ChatNotEligibleError();

    const conversation = await this.deps.chatRepository.findConversationById(conversationId);
    if (!conversation) throw new ChatConversationNotFoundError();

    const isCurrentClaimant = conversation.claimedByUserId === userId;
    const wasEverParticipant = conversation.participants.some((p) => p.userId === userId);
    const isPendingTransferParty = conversation.pendingTransferFromUserId === userId || conversation.pendingTransferToUserId === userId;

    if (!isCurrentClaimant && !wasEverParticipant && !isPendingTransferParty) {
      if (conversation.status !== 'WAITING' || !canClaimNewConversations({ roles: user.roles, roleClassName: user.roleClassName })) {
        throw new ChatNotEligibleError();
      }
    }

    // The PIN is only ever shown to the two people actually involved in that specific pending
    // handoff - never to the original claimant re-viewing history, or anyone else who can see
    // this conversation for another reason.
    const conversationForViewer: ChatConversationRecord = isPendingTransferParty ? conversation : { ...conversation, pendingTransferPin: null };

    const messages = await this.deps.chatRepository.listMessages(conversationId);
    return { conversation: conversationForViewer, messages, isReadOnly: !isCurrentClaimant };
  }
}
