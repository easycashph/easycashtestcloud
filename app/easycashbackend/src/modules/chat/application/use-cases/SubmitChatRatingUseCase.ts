import { ValidationError } from '@shared/errors/DomainError';
import type { IChatRepository } from '../ports/IChatRepository';
import { ChatConversationNotFoundError } from '../../domain/errors/ChatErrors';

export interface SubmitChatRatingUseCaseDeps {
  chatRepository: IChatRepository;
}

/** Post-chat CSAT rating (2026-08-20 user request) - only once, only after the conversation is
 * CLOSED (rating a still-open conversation makes no sense - the "experience" isn't over yet). */
export class SubmitChatRatingUseCase {
  constructor(private readonly deps: SubmitChatRatingUseCaseDeps) {}

  async execute(portalAccountId: string, conversationId: string, rating: number, comment: string | null): Promise<void> {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ValidationError('Rating must be an integer from 1 to 5.');
    }
    const conversation = await this.deps.chatRepository.findConversationById(conversationId);
    if (!conversation || conversation.portalAccountId !== portalAccountId) {
      throw new ChatConversationNotFoundError();
    }
    if (conversation.status !== 'CLOSED') {
      throw new ValidationError('This conversation has not ended yet.');
    }
    if (conversation.ratedAt) {
      throw new ValidationError('This conversation has already been rated.');
    }
    await this.deps.chatRepository.submitRating(conversationId, rating, comment?.trim() || null);
  }
}
