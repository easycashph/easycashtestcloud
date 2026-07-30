import type { DashboardSummary } from '../../../application/ports/IDashboardRepository';

/** Milestone 9.2 / D-5 convention: the only place a DashboardSummary is shaped for the wire.
 * Already JSON-safe from the repository (plain numbers/strings) — this exists to keep the
 * controller from touching the shape directly, matching every other module's presenter rule. */
export function presentDashboardSummary(summary: DashboardSummary) {
  return summary;
}
