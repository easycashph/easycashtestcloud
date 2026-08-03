import type { IChatRepository, ChatConversationRecord, ChatMessageRecord } from '../ports/IChatRepository';
import { ChatConversationNotFoundError } from '../../domain/errors/ChatErrors';

export interface GetPortalChatUseCaseDeps {
  chatRepository: IChatRepository;
}

export interface PortalChatView {
  conversation: ChatConversationRecord;
  messages: ChatMessageRecord[];
}

/** Backs the Portal chat widget's polling loop - the client's own conversation, ownership-checked
 * against `portalAccountId` (never the id alone). */
export class GetPortalChatUseCase {
  constructor(private readonly deps: GetPortalChatUseCaseDeps) {}

  async execute(portalAccountId: string, conversationId: string): Promise<PortalChatView> {
    const conversation = await this.deps.chatRepository.findConversationById(conversationId);
    if (!conversation || conversation.portalAccountId !== portalAccountId) {
      throw new ChatConversationNotFoundError();
    }
    const messages = await this.deps.chatRepository.listMessages(conversationId);
    return { conversation, messages };
  }
}
