import type { IChatRepository, ChatMessageRecord } from '../ports/IChatRepository';
import type { UploadAttachmentUseCase } from '@modules/document/application/use-cases/UploadAttachmentUseCase';
import { ValidationError } from '@shared/errors/DomainError';
import { ChatConversationClosedError, ChatConversationNotFoundError, ChatNotClaimantError } from '../../domain/errors/ChatErrors';

export interface SendStaffChatMessageInput {
  userId: string;
  conversationId: string;
  body?: string;
  file?: { fileName: string; fileType: string; data: Buffer };
}

export interface SendStaffChatMessageUseCaseDeps {
  chatRepository: IChatRepository;
  uploadAttachmentUseCase: UploadAttachmentUseCase;
}

/** Only the current claimant may reply - a conversation not yet claimed by this staff member
 * can't be replied to (they'd need to claim it first, via ClaimChatConversationUseCase). */
export class SendStaffChatMessageUseCase {
  constructor(private readonly deps: SendStaffChatMessageUseCaseDeps) {}

  async execute(input: SendStaffChatMessageInput): Promise<ChatMessageRecord> {
    const conversation = await this.deps.chatRepository.findConversationById(input.conversationId);
    if (!conversation) throw new ChatConversationNotFoundError();
    if (conversation.status === 'CLOSED') throw new ChatConversationClosedError();
    if (conversation.claimedByUserId !== input.userId) throw new ChatNotClaimantError();
    if (!input.body?.trim() && !input.file) {
      throw new ValidationError('Enter a message or attach a file.');
    }

    const message = await this.deps.chatRepository.addMessage({
      conversationId: input.conversationId,
      senderType: 'STAFF',
      senderUserId: input.userId,
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
        uploadedByUserId: input.userId,
      });
      return (await this.deps.chatRepository.findMessageById(message.id)) ?? message;
    }

    return message;
  }
}
