import type { IChatRepository, ChatConversationRecord } from '../ports/IChatRepository';

export interface StartOrResumePortalChatUseCaseDeps {
  chatRepository: IChatRepository;
}

/** A client resumes their existing open (WAITING/CLAIMED) conversation rather than starting a
 * second one every time they open the chat widget - only creates a new one if their last
 * conversation was CLOSED or they've never chatted before. */
export class StartOrResumePortalChatUseCase {
  constructor(private readonly deps: StartOrResumePortalChatUseCaseDeps) {}

  async execute(portalAccountId: string): Promise<ChatConversationRecord> {
    const existing = await this.deps.chatRepository.findActiveConversationForPortalAccount(portalAccountId);
    if (existing) return existing;
    return this.deps.chatRepository.createConversation(portalAccountId);
  }
}
