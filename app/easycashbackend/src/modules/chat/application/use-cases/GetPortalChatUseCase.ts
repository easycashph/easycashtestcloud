import type { ChatAgentStatus, IChatRepository, ChatConversationRecord, ChatMessageRecord } from '../ports/IChatRepository';
import { ChatConversationNotFoundError } from '../../domain/errors/ChatErrors';

export interface GetPortalChatUseCaseDeps {
  chatRepository: IChatRepository;
}

export interface PortalChatView {
  conversation: ChatConversationRecord;
  messages: ChatMessageRecord[];
  /** BPO-style "N ahead of you" queue position (2026-08-20 user request) - null once the
   * conversation is no longer WAITING (nothing meaningful to show at that point). */
  waitingPosition: number | null;
  /** The claimant's online/away/offline status (2026-08-20 user request) - null when nobody has
   * claimed yet, or the claimant has never set a presence status (treated as offline). */
  officerPresence: ChatAgentStatus | null;
}

/** Backs the Portal chat widget's polling loop - the client's own conversation, ownership-checked
 * against `portalAccountId` (never the id alone). Also marks the conversation read-by-portal on
 * every poll (2026-08-20) - the widget being open and polling IS the client viewing it. */
export class GetPortalChatUseCase {
  constructor(private readonly deps: GetPortalChatUseCaseDeps) {}

  async execute(portalAccountId: string, conversationId: string): Promise<PortalChatView> {
    const conversation = await this.deps.chatRepository.findConversationById(conversationId);
    if (!conversation || conversation.portalAccountId !== portalAccountId) {
      throw new ChatConversationNotFoundError();
    }
    const messages = await this.deps.chatRepository.listMessages(conversationId);
    await this.deps.chatRepository.markReadByPortal(conversationId);
    const waitingPosition =
      conversation.status === 'WAITING' ? await this.deps.chatRepository.countWaitingAheadOf(conversationId) : null;
    const officerPresence = conversation.claimedByUserId
      ? await this.deps.chatRepository.getAgentPresence(conversation.claimedByUserId)
      : null;
    return { conversation, messages, waitingPosition, officerPresence };
  }
}
