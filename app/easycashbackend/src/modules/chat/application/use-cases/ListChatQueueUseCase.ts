import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import type { IChatRepository, ChatConversationRecord } from '../ports/IChatRepository';
import { canClaimManagerConversations, canClaimNewConversations } from '../../domain/ChatEligibility';
import { ChatNotEligibleError } from '../../domain/errors/ChatErrors';

export interface ListChatQueueUseCaseDeps {
  userRepository: IUserRepository;
  chatRepository: IChatRepository;
}

/** The LMS "incoming chats" queue - a manager sees both the plain queue and anything transferred
 * up to them (see ChatEligibility.ts); anyone else claim-eligible sees only the plain queue. */
export class ListChatQueueUseCase {
  constructor(private readonly deps: ListChatQueueUseCaseDeps) {}

  async execute(userId: string): Promise<ChatConversationRecord[]> {
    const user = await this.deps.userRepository.findById(userId);
    if (!user) throw new ChatNotEligibleError();

    const eligibilityUser = { roles: user.roles, roleClassName: user.roleClassName };
    const isManager = canClaimManagerConversations(eligibilityUser);
    if (!isManager && !canClaimNewConversations(eligibilityUser)) {
      throw new ChatNotEligibleError();
    }

    return this.deps.chatRepository.listWaitingConversations(isManager);
  }
}
