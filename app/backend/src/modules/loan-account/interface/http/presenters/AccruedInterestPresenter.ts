import type { AccruedInterestFigures } from '../../../application/services/AccruedInterestCalculator';

/** 2026-07-24 — the only place `AccruedInterestFigures` becomes JSON-safe. */
export function presentAccruedInterest(figures: AccruedInterestFigures) {
  return {
    maturityDate: figures.maturityDate.toISOString(),
    totalPastDuePrincipal: figures.totalPastDuePrincipal.toString(),
    totalPastDueInterest: figures.totalPastDueInterest.toString(),
    totalPastDuePenalty: figures.totalPastDuePenalty.toString(),
    totalPastDue: figures.totalPastDue.toString(),
    daysLate: figures.daysLate,
    contractualRate: figures.contractualRate?.toString() ?? null,
    accruedInterest: figures.accruedInterest.toString(),
    breakdown: figures.breakdown.map((row) => ({
      installmentNumber: row.installmentNumber,
      dueDate: row.dueDate.toISOString(),
      unpaidPrincipal: row.unpaidPrincipal.toString(),
      unpaidInterest: row.unpaidInterest.toString(),
      frozenPenalty: row.frozenPenalty.toString(),
    })),
  };
}
