import type { IPortalNotificationRepository } from '../ports/IPortalNotificationRepository';
import type { PortalNotification } from '../../domain/PortalNotification';

export interface ListPortalNotificationsInput {
  portalAccountId: string;
  limit: number;
  cursor?: string;
  unreadOnly?: boolean;
}

export interface ListPortalNotificationsResult {
  items: PortalNotification[];
  unreadCount: number;
}

/** Mirrors the staff-facing ListNotificationsUseCase exactly, scoped to a portal account. */
export class ListPortalNotificationsUseCase {
  constructor(private readonly deps: { portalNotificationRepository: IPortalNotificationRepository }) {}

  async execute(input: ListPortalNotificationsInput): Promise<ListPortalNotificationsResult> {
    const [items, unreadCount] = await Promise.all([
      this.deps.portalNotificationRepository.findMany({
        portalAccountId: input.portalAccountId,
        limit: input.limit,
        cursor: input.cursor,
        unreadOnly: input.unreadOnly,
      }),
      this.deps.portalNotificationRepository.countUnread(input.portalAccountId),
    ]);

    return { items, unreadCount };
  }
}
