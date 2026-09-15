import type { NegativeAreaEntry } from '../../../application/ports/INegativeAreaRepository';

export function presentNegativeArea(entry: NegativeAreaEntry) {
  return { id: entry.id, city: entry.city, areaName: entry.areaName };
}
