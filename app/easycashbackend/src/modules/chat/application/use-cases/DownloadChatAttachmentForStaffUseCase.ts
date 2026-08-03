import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import type { AttachmentRecord, IAttachmentRepository } from '@modules/document/application/ports/IAttachmentRepository';
import type { IFileStorage } from '@modules/document/application/ports/IFileStorage';
import type { IChatRepository } from '../ports/IChatRepository';
import { canClaimManagerConversations, canClaimNewConversations } from '../../domain/ChatEligibility';
import { ChatConversationNotFoundError, ChatNotEligibleError } from '../../domain/errors/ChatErrors';

export interface DownloadChatAttachmentForStaffUseCaseDeps {
  userRepository: IUserRepository;
  chatRepository: IChatRepository;
  attachmentRepository: IAttachmentRepository;
  fileStorage: IFileStorage;
}

/** Same visibility rule as GetChatConversationForStaffUseCase - claimant (current or former), or
 * an eligible staff member previewing a still-WAITING conversation before claiming it. */
export class DownloadChatAttachmentForStaffUseCase {
  constructor(private readonly deps: DownloadChatAttachmentForStaffUseCaseDeps) {}

  async execute(userId: string, conversationId: string, attachmentId: string): Promise<{ record: AttachmentRecord; data: Buffer }> {
    const user = await this.deps.userRepository.findById(userId);
    if (!user) throw new ChatNotEligibleError();

    const conversation = await this.deps.chatRepository.findConversationById(conversationId);
    if (!conversation) throw new ChatConversationNotFoundError();

    const isClaimant = conversation.claimedByUserId === userId;
    if (!isClaimant) {
      if (conversation.status !== 'WAITING') throw new ChatNotEligibleError();
      const eligibilityUser = { roles: user.roles, roleClassName: user.roleClassName };
      const eligible = conversation.requiresManager
        ? canClaimManagerConversations(eligibilityUser)
        : canClaimNewConversations(eligibilityUser);
      if (!eligible) throw new ChatNotEligibleError();
    }

    const record = await this.deps.attachmentRepository.findById(attachmentId);
    if (!record || record.ownerType !== 'CHAT_MESSAGE') {
      throw new ChatConversationNotFoundError();
    }
    const message = await this.deps.chatRepository.findMessageById(record.ownerId);
    if (!message || message.conversationId !== conversationId) {
      throw new ChatConversationNotFoundError();
    }

    const data = await this.deps.fileStorage.read(record.storageKey);
    return { record, data };
  }
}
