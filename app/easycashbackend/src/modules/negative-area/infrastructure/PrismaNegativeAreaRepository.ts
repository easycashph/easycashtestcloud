import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import { ValidationError } from '@shared/errors/DomainError';
import type { CreateNegativeAreaInput, INegativeAreaRepository, NegativeAreaEntry } from '../application/ports/INegativeAreaRepository';

function toEntry(row: { id: string; city: string; areaName: string }): NegativeAreaEntry {
  return { id: row.id, city: row.city, areaName: row.areaName };
}

export class PrismaNegativeAreaRepository implements INegativeAreaRepository {
  async list(): Promise<NegativeAreaEntry[]> {
    const rows = await prisma.negativeArea.findMany({ orderBy: [{ city: 'asc' }, { areaName: 'asc' }] });
    return rows.map(toEntry);
  }

  async create(input: CreateNegativeAreaInput): Promise<NegativeAreaEntry> {
    try {
      const row = await prisma.negativeArea.create({ data: { city: input.city, areaName: input.areaName } });
      return toEntry(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ValidationError(`"${input.areaName}" is already on the list for ${input.city}.`);
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await prisma.negativeArea.delete({ where: { id } });
  }
}
