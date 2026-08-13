import { NotFoundError, ValidationError } from '@shared/errors/DomainError';
import type { SystemAnnouncement, UpdateSystemAnnouncementProps } from '../../domain/SystemAnnouncement';
import type { ISystemAnnouncementRepository } from '../ports/ISystemAnnouncementRepository';

export interface UpdateSystemAnnouncementUseCaseDeps {
  systemAnnouncementRepository: ISystemAnnouncementRepository;
}

/** Covers both content edits and the "Deactivate"/"Reactivate" admin-list actions (via
 * `patch.active`) - one PATCH-style use case rather than separate ones, matching the shape of
 * what the admin form/list actually sends. */
export class UpdateSystemAnnouncementUseCase {
  constructor(private readonly deps: UpdateSystemAnnouncementUseCaseDeps) {}

  async execute(id: string, patch: UpdateSystemAnnouncementProps): Promise<SystemAnnouncement> {
    const announcement = await this.deps.systemAnnouncementRepository.findById(id);
    if (!announcement) throw new NotFoundError('SystemAnnouncement', id);

    if (patch.title !== undefined && !patch.title.trim()) throw new ValidationError('Title is required.');
    if (patch.body !== undefined && !patch.body.trim()) throw new ValidationError('Message is required.');

    const props = announcement.toProps();
    const nextShowOnLms = patch.showOnLms ?? props.showOnLms;
    const nextShowOnPortal = patch.showOnPortal ?? props.showOnPortal;
    if (!nextShowOnLms && !nextShowOnPortal) {
      throw new ValidationError('Select at least one audience (LMS or Portal).');
    }

    announcement.update({
      ...patch,
      title: patch.title?.trim(),
      body: patch.body?.trim(),
    });
    await this.deps.systemAnnouncementRepository.save(announcement);
    return announcement;
  }
}
