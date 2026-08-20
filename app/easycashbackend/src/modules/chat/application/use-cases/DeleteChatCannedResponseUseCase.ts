import type { IChatRepository } from '../ports/IChatRepository';

export interface DeleteChatCannedResponseUseCaseDeps {
  chatRepository: IChatRepository;
}

export class DeleteChatCannedResponseUseCase {
  constructor(private readonly deps: DeleteChatCannedResponseUseCaseDeps) {}

  async execute(id: string): Promise<void> {
    await this.deps.chatRepository.deleteCannedResponse(id);
  }
}
