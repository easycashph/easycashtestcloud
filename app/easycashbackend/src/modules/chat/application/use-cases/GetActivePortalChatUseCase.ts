import type { IChatRepository, ChatConversationRecord } from '../ports/IChatRepository';

export interface GetActivePortalChatUseCaseDeps {
  chatRepository: IChatRepository;
}

/** Read-only peek at the client's existing open (WAITING/CLAIMED/PENDING_TRANSFER) conversation,
 * if any - never creates one (2026-08-03 user request: opening the chat widget must NOT put a
 * conversation in the Waiting queue by itself; only an explicit "Request Loan Officer Support"
 * click does that, via StartOrResumePortalChatUseCase). Lets the widget resume an already-active
 * chat on reopen without prematurely creating an empty one. */
export class GetActivePortalChatUseCase {
  constructor(private readonly deps: GetActivePortalChatUseCaseDeps) {}

  execute(portalAccountId: string): Promise<ChatConversationRecord | null> {
    return this.deps.chatRepository.findActiveConversationForPortalAccount(portalAccountId);
  }
}
