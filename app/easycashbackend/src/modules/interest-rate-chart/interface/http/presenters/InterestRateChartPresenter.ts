import type { InterestRateChartEntry } from '../../../application/ports/IInterestRateChartRepository';

export function presentInterestRateChartEntry(entry: InterestRateChartEntry) {
  return {
    id: entry.id,
    addOnRatePercent: entry.addOnRatePercent,
    termMonths: entry.termMonths,
    contractualRatePercent: entry.contractualRatePercent,
  };
}
