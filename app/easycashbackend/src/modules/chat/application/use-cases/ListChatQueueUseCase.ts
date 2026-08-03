import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import type { IChatRepository, ChatConversationRecord } from '../ports/IChatRepository';
import { canClaimNewConversations } from '../../domain/ChatEligibility';
import { ChatNotEligibleError } from '../../domain/errors/ChatErrors';

export interface ListChatQueueUseCaseDeps {
  userRepository: IUserRepository;
  chatRepository: IChatRepository;
}

/** The LMS "incoming chats" queue - every unclaimed, brand-new request, visible to every
 * claim-eligible staff member (see ChatEligibility.ts). */
export class ListChatQueueUseCase {
  constructor(private readonly deps: ListChatQueueUseCaseDeps) {}

  async execute(userId: string): Promise<ChatConversationRecord[]> {
    const user = await this.deps.userRepository.findById(userId);
    if (!user) throw new ChatNotEligibleError();
    if (!canClaimNewConversations({ roles: user.roles, roleClassName: user.roleClassName })) {
      throw new ChatNotEligibleError();
    }

    return this.deps.chatRepository.listWaitingConversations();
  }
}
