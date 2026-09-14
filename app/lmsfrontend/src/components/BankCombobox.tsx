import { Landmark } from 'lucide-react';
import { PHILIPPINE_BANKS } from '@/lib/philippineBanks';
import { StaticSuggestionsCombobox } from '@/components/StaticSuggestionsCombobox';

/**
 * 2026-09-14 (bank suggestions, user request): searchable combobox over a static reference list
 * of common Philippine banks (see philippineBanks.ts - not an official BSP registry lookup), for
 * the "Mode of payment and mitigation" section's Bank field (bank/ATM surrendered as security).
 */
export function BankCombobox({ value, onChange, className }: { value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <StaticSuggestionsCombobox
      value={value}
      onChange={onChange}
      options={PHILIPPINE_BANKS}
      placeholder="Type or pick a bank…"
      icon={Landmark}
      className={className}
    />
  );
}
