import { Briefcase } from 'lucide-react';
import { SEAFARER_POSITIONS } from '@/lib/seafarerPositions';
import { StaticSuggestionsCombobox } from '@/components/StaticSuggestionsCombobox';

/**
 * 2026-09-14 (seafarer position suggestions, user request): searchable combobox over a static
 * reference list of common seafarer ranks/positions (see seafarerPositions.ts - general maritime
 * terminology, not an official registry like DMW's agency directory), for the Seafarer Loan
 * "Agency / contract / allotment verification" section's Position field.
 */
export function SeafarerPositionCombobox({ value, onChange, className }: { value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <StaticSuggestionsCombobox
      value={value}
      onChange={onChange}
      options={SEAFARER_POSITIONS}
      placeholder="Type or pick a position…"
      icon={Briefcase}
      className={className}
    />
  );
}
