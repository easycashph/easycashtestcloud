import { ValidationError } from '@shared/errors/DomainError';
import { SystemAnnouncement, type SystemAnnouncementType } from '../../domain/SystemAnnouncement';
import type { ISystemAnnouncementRepository } from '../ports/ISystemAnnouncementRepository';

export interface CreateSystemAnnouncementInput {
  title: string;
  body: string;
  type: SystemAnnouncementType;
  showOnLms: boolean;
  showOnPortal: boolean;
  expiresAt: Date | null;
  createdByUserId: string;
}

export interface CreateSystemAnnouncementUseCaseDeps {
  systemAnnouncementRepository: ISystemAnnouncementRepository;
}

export class CreateSystemAnnouncementUseCase {
  constructor(private readonly deps: CreateSystemAnnouncementUseCaseDeps) {}

  async execute(input: CreateSystemAnnouncementInput): Promise<SystemAnnouncement> {
    if (!input.title.trim()) throw new ValidationError('Title is required.');
    if (!input.body.trim()) throw new ValidationError('Message is required.');
    if (!input.showOnLms && !input.showOnPortal) {
      throw new ValidationError('Select at least one audience (LMS or Portal).');
    }

    const announcement = SystemAnnouncement.create({
      title: input.title.trim(),
      body: input.body.trim(),
      type: input.type,
      showOnLms: input.showOnLms,
      showOnPortal: input.showOnPortal,
      expiresAt: input.expiresAt,
      createdByUserId: input.createdByUserId,
    });

    await this.deps.systemAnnouncementRepository.save(announcement);
    return announcement;
  }
}
