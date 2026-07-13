import { TermTip } from '@/components/TermTip';
import { ROLE_GLOSSARY, roleShortLabel } from '@/lib/roleGlossary';

/**
 * Displays a role name using its short form (e.g. "LOM" for "Loan Operation
 * Manager") with a hover/focus tooltip showing the full meaning - reuses the
 * same `TermTip` pattern already used for financial-term abbreviations
 * (PAR, delinquency rate, etc.) on the Dashboard.
 */
export function RoleAbbr({ role }: { role: string }) {
  const entry = ROLE_GLOSSARY[role];
  if (!entry) return <>{role}</>;
  return (
    <span className="inline-flex items-center gap-0.5">
      {roleShortLabel(role)}
      <TermTip term={entry.short} definition={entry.full} />
    </span>
  );
}
