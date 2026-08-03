import type { IChatRepository, ChatMessageRecord } from '../ports/IChatRepository';
import type { UploadAttachmentUseCase } from '@modules/document/application/use-cases/UploadAttachmentUseCase';
import { ValidationError } from '@shared/errors/DomainError';
import { ChatConversationClosedError, ChatConversationNotFoundError } from '../../domain/errors/ChatErrors';

export interface SendPortalChatMessageInput {
  portalAccountId: string;
  conversationId: string;
  body?: string;
  file?: { fileName: string; fileType: string; data: Buffer };
}

export interface SendPortalChatMessageUseCaseDeps {
  chatRepository: IChatRepository;
  uploadAttachmentUseCase: UploadAttachmentUseCase;
}

/** A client sending a message in their own conversation - ownership-checked, and a message must
 * carry at least a body or a file (never a fully empty bubble). */
export class SendPortalChatMessageUseCase {
  constructor(private readonly deps: SendPortalChatMessageUseCaseDeps) {}

  async execute(input: SendPortalChatMessageInput): Promise<ChatMessageRecord> {
    const conversation = await this.deps.chatRepository.findConversationById(input.conversationId);
    if (!conversation || conversation.portalAccountId !== input.portalAccountId) {
      throw new ChatConversationNotFoundError();
    }
    if (conversation.status === 'CLOSED') throw new ChatConversationClosedError();
    if (!input.body?.trim() && !input.file) {
      throw new ValidationError('Enter a message or attach a file.');
    }

    const message = await this.deps.chatRepository.addMessage({
      conversationId: input.conversationId,
      senderType: 'PORTAL_ACCOUNT',
      body: input.body?.trim() || undefined,
    });

    if (input.file) {
      await this.deps.uploadAttachmentUseCase.execute({
        ownerType: 'CHAT_MESSAGE',
        ownerId: message.id,
        fileName: input.file.fileName,
        fileType: input.file.fileType,
        data: input.file.data,
        documentCategory: null,
        uploadedByUserId: null,
      });
      return (await this.deps.chatRepository.findMessageById(message.id)) ?? message;
    }

    return message;
  }
}
