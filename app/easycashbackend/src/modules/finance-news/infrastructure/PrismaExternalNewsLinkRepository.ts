import { prisma } from '@shared/database/prismaClient';
import type {
  CreateExternalNewsLinkInput,
  ExternalNewsLinkRecord,
  IExternalNewsLinkRepository,
  ListExternalNewsLinksOptions,
} from '../application/ports/IExternalNewsLinkRepository';

export class PrismaExternalNewsLinkRepository implements IExternalNewsLinkRepository {
  async findBySourceUrl(sourceUrl: string): Promise<ExternalNewsLinkRecord | null> {
    const row = await prisma.externalNewsLink.findUnique({ where: { sourceUrl } });
    return row as ExternalNewsLinkRecord | null;
  }

  async create(input: CreateExternalNewsLinkInput): Promise<ExternalNewsLinkRecord> {
    const created = await prisma.externalNewsLink.create({ data: input });
    return created as ExternalNewsLinkRecord;
  }

  async findMany(options: ListExternalNewsLinksOptions): Promise<ExternalNewsLinkRecord[]> {
    const rows = await prisma.externalNewsLink.findMany({
      where: options.category ? { category: options.category } : undefined,
      orderBy: { publishedAt: 'desc' },
      take: options.limit,
    });
    return rows as ExternalNewsLinkRecord[];
  }
}
