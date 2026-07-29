export interface InterestRateChartEntry {
  id: string;
  addOnRatePercent: string;
  termMonths: number;
  contractualRatePercent: string;
}

export interface IInterestRateChartRepository {
  /** The whole chart — small, static reference data (see the Prisma model's own doc comment); no pagination needed. */
  findAll(): Promise<InterestRateChartEntry[]>;
}
