import { NotFoundError } from '@shared/errors/DomainError';
import type { ISystemAnnouncementRepository } from '../ports/ISystemAnnouncementRepository';

export interface DeleteSystemAnnouncementUseCaseDeps {
  systemAnnouncementRepository: ISystemAnnouncementRepository;
}

export class DeleteSystemAnnouncementUseCase {
  constructor(private readonly deps: DeleteSystemAnnouncementUseCaseDeps) {}

  async execute(id: string): Promise<void> {
    const announcement = await this.deps.systemAnnouncementRepository.findById(id);
    if (!announcement) throw new NotFoundError('SystemAnnouncement', id);
    await this.deps.systemAnnouncementRepository.delete(id);
  }
}
