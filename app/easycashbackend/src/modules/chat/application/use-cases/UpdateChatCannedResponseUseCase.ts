import { ValidationError } from '@shared/errors/DomainError';
import type { ChatCannedResponseRecord, IChatRepository } from '../ports/IChatRepository';

export interface UpdateChatCannedResponseUseCaseDeps {
  chatRepository: IChatRepository;
}

export class UpdateChatCannedResponseUseCase {
  constructor(private readonly deps: UpdateChatCannedResponseUseCaseDeps) {}

  async execute(id: string, title: string, body: string): Promise<ChatCannedResponseRecord> {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle) throw new ValidationError('Title is required.');
    if (!trimmedBody) throw new ValidationError('Body is required.');
    return this.deps.chatRepository.updateCannedResponse(id, trimmedTitle, trimmedBody);
  }
}
