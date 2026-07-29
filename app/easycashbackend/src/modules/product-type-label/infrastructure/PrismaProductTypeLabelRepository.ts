import { prisma } from '@shared/database/prismaClient';
import { ProductTypeLabel } from '../domain/ProductTypeLabel';
import type { IProductTypeLabelRepository } from '../application/ports/IProductTypeLabelRepository';

function toDomain(row: { id: string; canonicalKey: string; label: string; createdAt: Date; updatedAt: Date }): ProductTypeLabel {
  return ProductTypeLabel.fromRecord(row);
}

export class PrismaProductTypeLabelRepository implements IProductTypeLabelRepository {
  async findAll(): Promise<ProductTypeLabel[]> {
    const rows = await prisma.productTypeLabel.findMany({ orderBy: { canonicalKey: 'asc' } });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<ProductTypeLabel | null> {
    const row = await prisma.productTypeLabel.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async update(id: string, label: string): Promise<ProductTypeLabel> {
    const row = await prisma.productTypeLabel.update({ where: { id }, data: { label } });
    return toDomain(row);
  }
}
