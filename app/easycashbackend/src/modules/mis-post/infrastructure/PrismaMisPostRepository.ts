import { prisma } from '@shared/database/prismaClient';
import { MisPost, type MisPostProps } from '../domain/MisPost';
import type { IMisPostRepository } from '../application/ports/IMisPostRepository';

function toDomain(row: MisPostProps): MisPost {
  return MisPost.reconstitute(row);
}

export class PrismaMisPostRepository implements IMisPostRepository {
  async findById(id: string): Promise<MisPost | null> {
    const row = await prisma.misPost.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findManyForAdmin(): Promise<MisPost[]> {
    const rows = await prisma.misPost.findMany({ orderBy: [{ type: 'asc' }, { createdAt: 'desc' }] });
    return rows.map(toDomain);
  }

  async findCurrentLiveAutoPost(): Promise<MisPost | null> {
    const row = await prisma.misPost.findFirst({
      where: { type: 'AUTO_ROTATION', isCurrentlyLive: true },
    });
    return row ? toDomain(row) : null;
  }

  async findAutoRotationPool(): Promise<MisPost[]> {
    const rows = await prisma.misPost.findMany({
      where: { type: 'AUTO_ROTATION', poolActive: true },
      orderBy: { poolOrder: 'asc' },
    });
    return rows.map(toDomain);
  }

  async findActiveManualPosts(asOf: Date): Promise<MisPost[]> {
    const rows = await prisma.misPost.findMany({
      where: { type: 'MANUAL', withdrawn: false, expiresAt: { gt: asOf } },
      orderBy: { publishedAt: 'desc' },
    });
    return rows.map(toDomain);
  }

  async save(post: MisPost): Promise<void> {
    const props = post.toProps();
    await prisma.misPost.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        type: props.type,
        caption: props.caption,
        imageStorageKey: props.imageStorageKey,
        imageFileName: props.imageFileName,
        imageFileType: props.imageFileType,
        poolOrder: props.poolOrder,
        poolActive: props.poolActive,
        isCurrentlyLive: props.isCurrentlyLive,
        publishedAt: props.publishedAt,
        expiresAt: props.expiresAt,
        withdrawn: props.withdrawn,
        createdByUserId: props.createdByUserId,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        caption: props.caption,
        poolActive: props.poolActive,
        isCurrentlyLive: props.isCurrentlyLive,
        withdrawn: props.withdrawn,
        updatedAt: props.updatedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.misPost.delete({ where: { id } });
  }
}
