import type { IPortalNotificationRepository } from '../ports/IPortalNotificationRepository';

/** Mirrors the staff-facing MarkAllNotificationsReadUseCase exactly, scoped to a portal account. */
export class MarkAllPortalNotificationsReadUseCase {
  constructor(private readonly deps: { portalNotificationRepository: IPortalNotificationRepository }) {}

  async execute(portalAccountId: string): Promise<void> {
    await this.deps.portalNotificationRepository.markAllRead(portalAccountId);
  }
}
