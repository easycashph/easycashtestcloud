import { prisma } from '@shared/database/prismaClient';
import type { IInterestRateChartRepository, InterestRateChartEntry } from '../application/ports/IInterestRateChartRepository';

export class PrismaInterestRateChartRepository implements IInterestRateChartRepository {
  async findAll(): Promise<InterestRateChartEntry[]> {
    const rows = await prisma.interestRateChart.findMany({
      orderBy: [{ addOnRatePercent: 'asc' }, { termMonths: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      addOnRatePercent: row.addOnRatePercent.toString(),
      termMonths: row.termMonths,
      contractualRatePercent: row.contractualRatePercent.toString(),
    }));
  }
}
