import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import type { IPortalAccountRepository } from '@modules/client-portal/application/ports/IPortalAccountRepository';
import type { ILoanApplicationRepository } from '@modules/loan-application/application/ports/ILoanApplicationRepository';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { IChatRepository, ChatConversationRecord, ChatMessageRecord } from '../ports/IChatRepository';
import { ChatConversationNotFoundError, ChatNotEligibleError } from '../../domain/errors/ChatErrors';
import { buildChatClientInfo, type ChatClientInfo } from '../ChatClientInfo';

export interface GetChatConversationForMisUseCaseDeps {
  userRepository: IUserRepository;
  chatRepository: IChatRepository;
  portalAccountRepository: IPortalAccountRepository;
  loanApplicationRepository: ILoanApplicationRepository;
  borrowerRepository: IBorrowerRepository;
}

export interface MisChatView {
  conversation: ChatConversationRecord;
  messages: ChatMessageRecord[];
  client: ChatClientInfo;
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

    // Same redaction as GetChatConversationForStaffUseCase - the PIN is only ever shown to the
    // two people actually party to that specific handoff, not to MIS reviewing after the fact.
    const messages = await this.deps.chatRepository.listMessages(conversationId);
    const client = await buildChatClientInfo(this.deps, conversation.portalAccountId);
    return { conversation: { ...conversation, pendingTransferPin: null }, messages, client };
  }
}
