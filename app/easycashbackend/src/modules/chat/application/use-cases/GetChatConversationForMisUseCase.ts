import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import type { IChatRepository, ChatConversationRecord, ChatMessageRecord } from '../ports/IChatRepository';
import { ChatConversationNotFoundError, ChatNotEligibleError } from '../../domain/errors/ChatErrors';

export interface GetChatConversationForMisUseCaseDeps {
  userRepository: IUserRepository;
  chatRepository: IChatRepository;
}

export interface MisChatView {
  conversation: ChatConversationRecord;
  messages: ChatMessageRecord[];
}

/** MIS-only, read-only - full message history of ANY conversation, no claimant/eligibility
 * restriction (2026-07-31 user request, "Staff Chat Oversight"). */
export class GetChatConversationForMisUseCase {
  constructor(private readonly deps: GetChatConversationForMisUseCaseDeps) {}

  async execute(userId: string, conversationId: string): Promise<MisChatView> {
    const user = await this.deps.userRepository.findById(userId);
    if (!user || !user.roles.includes('MIS')) throw new ChatNotEligibleError();

    const conversation = await this.deps.chatRepository.findConversationById(conversationId);
    if (!conversation) throw new ChatConversationNotFoundError();

    const messages = await this.deps.chatRepository.listMessages(conversationId);
    return { conversation, messages };
  }
}
