import { prisma } from '@shared/database/prismaClient';
import type {
  ILicensedRecruitmentAgencyRepository,
  LicensedRecruitmentAgencyEntry,
} from '../application/ports/ILicensedRecruitmentAgencyRepository';

export class PrismaLicensedRecruitmentAgencyRepository implements ILicensedRecruitmentAgencyRepository {
  async search(query: string, limit: number): Promise<LicensedRecruitmentAgencyEntry[]> {
    const rows = await prisma.licensedRecruitmentAgency.findMany({
      where: { name: { contains: query, mode: 'insensitive' } },
      orderBy: { name: 'asc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      contactName: row.contactName,
      phone: row.phone,
      licenseNumber: row.licenseNumber,
      status: row.status,
    }));
  }
}
