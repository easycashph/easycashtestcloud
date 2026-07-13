import { prisma } from '@shared/database/prismaClient';
import type { BranchLocation, IBranchRepository } from '../application/ports/IBranchRepository';

export class PrismaBranchRepository implements IBranchRepository {
  async findById(id: string): Promise<BranchLocation | null> {
    const row = await prisma.branch.findUnique({
      where: { id },
      select: { id: true, address: true, latitude: true, longitude: true },
    });
    if (!row) return null;
    return {
      id: row.id,
      address: row.address,
      latitude: row.latitude ? Number(row.latitude) : null,
      longitude: row.longitude ? Number(row.longitude) : null,
    };
  }

  async updateCoordinates(id: string, latitude: number, longitude: number): Promise<void> {
    await prisma.branch.update({ where: { id }, data: { latitude, longitude } });
  }
}
