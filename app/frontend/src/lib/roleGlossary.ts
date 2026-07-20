/**
 * Full meanings for role abbreviations shown across the LMS UI (see `RoleAbbr.tsx`).
 * Only roles that are actual abbreviations are listed here - "Finance", "Accounting", and
 * "Collection Officer" are already plain words and need no expansion.
 */
export const ROLE_GLOSSARY: Record<string, { short: string; full: string }> = {
  MIS: { short: 'MIS', full: 'Management Information System' },
  'Loan Operation Manager': { short: 'LOM', full: 'Loan Operation Manager' },
  CRM: { short: 'CRM', full: 'Customer Relation Management' },
};

/** Display label for a role - the short abbreviation where one exists, the role name otherwise. */
export function roleShortLabel(role: string): string {
  return ROLE_GLOSSARY[role]?.short ?? role;
}

/** Full spelled-out label for a role (2026-07-20, Administration > System > User Accounts request) - the role name otherwise. */
export function roleFullLabel(role: string): string {
  return ROLE_GLOSSARY[role]?.full ?? role;
}
