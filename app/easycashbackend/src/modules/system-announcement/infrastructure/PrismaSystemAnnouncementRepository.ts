import { prisma } from '@shared/database/prismaClient';
import { SystemAnnouncement, type SystemAnnouncementProps } from '../domain/SystemAnnouncement';
import type { ISystemAnnouncementRepository } from '../application/ports/ISystemAnnouncementRepository';

function toDomain(row: SystemAnnouncementProps): SystemAnnouncement {
  return SystemAnnouncement.reconstitute(row);
}

export class PrismaSystemAnnouncementRepository implements ISystemAnnouncementRepository {
  async findById(id: string): Promise<SystemAnnouncement | null> {
    const row = await prisma.systemAnnouncement.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findMany(): Promise<SystemAnnouncement[]> {
    const rows = await prisma.systemAnnouncement.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toDomain);
  }

  async findActiveForAudience(audience: 'LMS' | 'PORTAL', asOf: Date): Promise<SystemAnnouncement | null> {
    const row = await prisma.systemAnnouncement.findFirst({
      where: {
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: asOf } }],
        ...(audience === 'LMS' ? { showOnLms: true } : { showOnPortal: true }),
      },
      orderBy: { createdAt: 'desc' },
    });
    return row ? toDomain(row) : null;
  }

  async save(announcement: SystemAnnouncement): Promise<void> {
    const props = announcement.toProps();
    await prisma.systemAnnouncement.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        title: props.title,
        body: props.body,
        type: props.type,
        showOnLms: props.showOnLms,
        showOnPortal: props.showOnPortal,
        active: props.active,
        expiresAt: props.expiresAt,
        createdByUserId: props.createdByUserId,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        title: props.title,
        body: props.body,
        type: props.type,
        showOnLms: props.showOnLms,
        showOnPortal: props.showOnPortal,
        active: props.active,
        expiresAt: props.expiresAt,
        updatedAt: props.updatedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.systemAnnouncement.delete({ where: { id } });
  }
}
