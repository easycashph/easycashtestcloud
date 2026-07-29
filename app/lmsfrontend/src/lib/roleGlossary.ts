/**
 * Full meanings/display labels for roles shown across the LMS UI (see `RoleAbbr.tsx`,
 * `roleFullLabel()`). "Finance" and "Accounting" are already plain words and need no entry here.
 */
export const ROLE_GLOSSARY: Record<string, { short: string; full: string }> = {
  MIS: { short: 'MIS', full: 'Management Information System' },
  'Loan Operation Manager': { short: 'LOM', full: 'Loan Operation Management' },
  CRM: { short: 'CRM', full: 'Customer Relation Management' },
  /** 2026-07-20 user request: shown as just "Collection" wherever the full label is used. */
  'Collection Officer': { short: 'Collection Officer', full: 'Collection' },
};

/** Display label for a role - the short abbreviation where one exists, the role name otherwise. */
export function roleShortLabel(role: string): string {
  return ROLE_GLOSSARY[role]?.short ?? role;
}

/** Full spelled-out label for a role (2026-07-20, Administration > System > User Accounts request) - the role name otherwise. */
export function roleFullLabel(role: string): string {
  return ROLE_GLOSSARY[role]?.full ?? role;
}
