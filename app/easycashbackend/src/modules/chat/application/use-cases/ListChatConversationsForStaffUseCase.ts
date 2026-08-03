import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import type { IChatRepository, ChatConversationRecord } from '../ports/IChatRepository';
import { ChatNotEligibleError } from '../../domain/errors/ChatErrors';

export interface ListChatConversationsForStaffUseCaseDeps {
  userRepository: IUserRepository;
  chatRepository: IChatRepository;
}

/** MIS-only - a specific staff member's chat history (2026-07-31 user request), any status. */
export class ListChatConversationsForStaffUseCase {
  constructor(private readonly deps: ListChatConversationsForStaffUseCaseDeps) {}

  async execute(requestingUserId: string, targetUserId: string): Promise<ChatConversationRecord[]> {
    const requestingUser = await this.deps.userRepository.findById(requestingUserId);
    if (!requestingUser || !requestingUser.roles.includes('MIS')) throw new ChatNotEligibleError();

    return this.deps.chatRepository.listConversationsEverClaimedByUser(targetUserId);
  }
}
