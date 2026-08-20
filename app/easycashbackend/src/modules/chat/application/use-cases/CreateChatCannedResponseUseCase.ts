import { ValidationError } from '@shared/errors/DomainError';
import type { ChatCannedResponseRecord, IChatRepository } from '../ports/IChatRepository';

export interface CreateChatCannedResponseUseCaseDeps {
  chatRepository: IChatRepository;
}

/** MIS-managed shared canned-response library (2026-08-20 user request) - gated MIS-only at the
 * HTTP layer, same posture as every other admin-config feature in this codebase. */
export class CreateChatCannedResponseUseCase {
  constructor(private readonly deps: CreateChatCannedResponseUseCaseDeps) {}

  async execute(title: string, body: string, createdByUserId: string): Promise<ChatCannedResponseRecord> {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle) throw new ValidationError('Title is required.');
    if (!trimmedBody) throw new ValidationError('Body is required.');
    return this.deps.chatRepository.createCannedResponse(trimmedTitle, trimmedBody, createdByUserId);
  }
}
