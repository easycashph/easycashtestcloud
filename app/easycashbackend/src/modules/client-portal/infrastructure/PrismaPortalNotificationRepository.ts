import type { PortalNotification as PrismaPortalNotificationRow } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import type { FindManyPortalNotificationsOptions, IPortalNotificationRepository } from '../application/ports/IPortalNotificationRepository';
import { PortalNotification, type PortalNotificationType } from '../domain/PortalNotification';

function toDomain(row: PrismaPortalNotificationRow): PortalNotification {
  return PortalNotification.reconstitute({
    id: row.id,
    portalAccountId: row.portalAccountId,
    type: row.type as PortalNotificationType,
    title: row.title,
    body: row.body,
    entityType: row.entityType,
    entityId: row.entityId,
    read: row.read,
    readAt: row.readAt,
    createdAt: row.createdAt,
  });
}

/** Mirrors the staff-facing PrismaNotificationRepository exactly, scoped to portalAccountId. */
export class PrismaPortalNotificationRepository implements IPortalNotificationRepository {
  async create(notification: PortalNotification): Promise<void> {
    await prisma.portalNotification.create({
      data: {
        id: notification.id,
        portalAccountId: notification.portalAccountId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        entityType: notification.entityType,
        entityId: notification.entityId,
        read: notification.read,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      },
    });
  }

  async findById(id: string): Promise<PortalNotification | null> {
    const row = await prisma.portalNotification.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findMany(options: FindManyPortalNotificationsOptions): Promise<PortalNotification[]> {
    const rows = await prisma.portalNotification.findMany({
      where: {
        portalAccountId: options.portalAccountId,
        ...(options.unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomain);
  }

  async countUnread(portalAccountId: string): Promise<number> {
    return prisma.portalNotification.count({ where: { portalAccountId, read: false } });
  }

  async markRead(id: string): Promise<void> {
    await prisma.portalNotification.update({ where: { id }, data: { read: true, readAt: new Date() } });
  }

  async markAllRead(portalAccountId: string): Promise<void> {
    await prisma.portalNotification.updateMany({ where: { portalAccountId, read: false }, data: { read: true, readAt: new Date() } });
  }
}
