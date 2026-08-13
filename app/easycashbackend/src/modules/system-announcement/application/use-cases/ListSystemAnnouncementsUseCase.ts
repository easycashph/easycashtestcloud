import type { SystemAnnouncement } from '../../domain/SystemAnnouncement';
import type { ISystemAnnouncementRepository } from '../ports/ISystemAnnouncementRepository';

export interface ListSystemAnnouncementsUseCaseDeps {
  systemAnnouncementRepository: ISystemAnnouncementRepository;
}

/** MIS admin history list - every announcement ever posted, active or not. */
export class ListSystemAnnouncementsUseCase {
  constructor(private readonly deps: ListSystemAnnouncementsUseCaseDeps) {}

  async execute(): Promise<SystemAnnouncement[]> {
    return this.deps.systemAnnouncementRepository.findMany();
  }
}
