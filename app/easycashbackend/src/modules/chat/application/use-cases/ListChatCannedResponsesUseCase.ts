import type { ChatCannedResponseRecord, IChatRepository } from '../ports/IChatRepository';

export interface ListChatCannedResponsesUseCaseDeps {
  chatRepository: IChatRepository;
}

export class ListChatCannedResponsesUseCase {
  constructor(private readonly deps: ListChatCannedResponsesUseCaseDeps) {}

  async execute(): Promise<ChatCannedResponseRecord[]> {
    return this.deps.chatRepository.listCannedResponses();
  }
}
