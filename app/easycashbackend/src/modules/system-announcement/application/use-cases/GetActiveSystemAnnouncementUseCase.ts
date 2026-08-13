import type { SystemAnnouncement } from '../../domain/SystemAnnouncement';
import type { ISystemAnnouncementRepository } from '../ports/ISystemAnnouncementRepository';

export interface GetActiveSystemAnnouncementUseCaseDeps {
  systemAnnouncementRepository: ISystemAnnouncementRepository;
}

/** Backs the popup both apps poll on load - the one currently-relevant announcement for that
 * audience, or `null` if there's genuinely nothing to show. No auth requirement on the caller
 * side (see the public portal route) - an announcement is deliberately not sensitive data. */
export class GetActiveSystemAnnouncementUseCase {
  constructor(private readonly deps: GetActiveSystemAnnouncementUseCaseDeps) {}

  async execute(audience: 'LMS' | 'PORTAL'): Promise<SystemAnnouncement | null> {
    return this.deps.systemAnnouncementRepository.findActiveForAudience(audience, new Date());
  }
}
