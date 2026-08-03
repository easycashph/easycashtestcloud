import type { IChatRepository, ChatConversationRecord } from '../ports/IChatRepository';

export interface StartOrResumePortalChatUseCaseDeps {
  chatRepository: IChatRepository;
}

/** Called only when the client explicitly clicks "Request Loan Officer Support" (2026-08-03 user
 * request) - opening the chat widget alone no longer calls this (see GetActivePortalChatUseCase).
 * Still resumes an existing open (WAITING/CLAIMED/PENDING_TRANSFER) conversation rather than
 * starting a second one if they click the button again mid-conversation - only creates a new one
 * if their last conversation was CLOSED or they've never chatted before. */
export class StartOrResumePortalChatUseCase {
  constructor(private readonly deps: StartOrResumePortalChatUseCaseDeps) {}

  async execute(portalAccountId: string): Promise<ChatConversationRecord> {
    const existing = await this.deps.chatRepository.findActiveConversationForPortalAccount(portalAccountId);
    if (existing) return existing;
    return this.deps.chatRepository.createConversation(portalAccountId);
  }
}
