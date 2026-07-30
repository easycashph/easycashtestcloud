import type { PortalNotification } from '../../domain/PortalNotification';

export interface FindManyPortalNotificationsOptions {
  portalAccountId: string;
  limit: number;
  cursor?: string;
  unreadOnly?: boolean;
}

export interface IPortalNotificationRepository {
  create(notification: PortalNotification): Promise<void>;
  findById(id: string): Promise<PortalNotification | null>;
  findMany(options: FindManyPortalNotificationsOptions): Promise<PortalNotification[]>;
  countUnread(portalAccountId: string): Promise<number>;
  markRead(id: string): Promise<void>;
  markAllRead(portalAccountId: string): Promise<void>;
}
