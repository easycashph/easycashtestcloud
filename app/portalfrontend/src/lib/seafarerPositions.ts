/**
 * 2026-09-15 (user request): reference list of common seafarer positions/ranks (STCW-based deck,
 * engine, and catering department titles), used as suggestions for the Seafarer Loan application
 * form's "Position" field. Mirrors app/lmsfrontend's own seafarerPositions.ts (the staff-facing
 * Agency Verification section's list) so the same vocabulary is offered on both sides.
 *
 * Not sourced from an official registry - there isn't one for job titles - it's general
 * maritime-industry terminology, kept here as a starting suggestion list only. The Position field
 * stays free text; an applicant's actual position not on this list must never be blocked from
 * being recorded as-is.
 */
export const SEAFARER_POSITIONS: string[] = [
  // Deck Department
  'Master / Captain',
  'Chief Officer / Chief Mate',
  'Second Officer / Second Mate',
  'Third Officer / Third Mate',
  'Deck Cadet',
  'Bosun (Boatswain)',
  'Able Seaman (AB)',
  'Ordinary Seaman (OS)',
  'Deck Fitter',
  // Engine Department
  'Chief Engineer',
  'Second Engineer',
  'Third Engineer',
  'Fourth Engineer',
  'Engine Cadet',
  'Electro-Technical Officer (ETO)',
  'Electrician',
  'Fitter',
  'Oiler',
  'Wiper',
  'Motorman',
  // Catering / Steward Department
  'Chief Cook',
  'Cook',
  'Messman',
  'Steward',
  'Chief Steward',
  // Other / Specialized
  'Pumpman',
  'Radio Officer',
  'Able Seafarer Deck',
  'Able Seafarer Engine',
];
