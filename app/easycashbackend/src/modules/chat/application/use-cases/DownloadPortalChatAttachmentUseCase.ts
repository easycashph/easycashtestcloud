import type { AttachmentRecord, IAttachmentRepository } from '@modules/document/application/ports/IAttachmentRepository';
import type { IFileStorage } from '@modules/document/application/ports/IFileStorage';
import type { IChatRepository } from '../ports/IChatRepository';
import { ChatConversationNotFoundError } from '../../domain/errors/ChatErrors';

export interface DownloadPortalChatAttachmentUseCaseDeps {
  chatRepository: IChatRepository;
  attachmentRepository: IAttachmentRepository;
  fileStorage: IFileStorage;
}

/** A client may only download an attachment from their own conversation - same unified
 * "not found" error whether it truly doesn't exist or belongs to someone else's chat. */
export class DownloadPortalChatAttachmentUseCase {
  constructor(private readonly deps: DownloadPortalChatAttachmentUseCaseDeps) {}

  async execute(portalAccountId: string, conversationId: string, attachmentId: string): Promise<{ record: AttachmentRecord; data: Buffer }> {
    const conversation = await this.deps.chatRepository.findConversationById(conversationId);
    if (!conversation || conversation.portalAccountId !== portalAccountId) {
      throw new ChatConversationNotFoundError();
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
