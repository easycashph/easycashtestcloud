import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/apiClient';
import type { PsgcOption } from '@/lib/psgcApiTypes';

export interface AddressDraft {
  houseUnitNumber: string;
  street: string;
  barangay: string;
  cityMunicipality: string;
  province: string;
  zipCode: string;
}

export function emptyAddressDraft(): AddressDraft {
  return { houseUnitNumber: '', street: '', barangay: '', cityMunicipality: '', province: '', zipCode: '' };
}

function usePsgcOptions(path: string, enabled: boolean) {
  return useQuery({
    queryKey: ['psgc', path],
    queryFn: () => apiClient.get<{ items: PsgcOption[] }>(path).then((r) => r.items),
    enabled,
  });
}

/**
 * Region -> Province -> City/Municipality -> Barangay cascading picker, backed by the real PSGC
 * reference data (`GET /psgc/regions|provinces|cities|barangays`) — replaces free-text address
 * entry so a value can never again be saved as a raw PSGC code instead of a name (see
 * scripts/fix-coded-addresses.ts for the data-quality issue this prevents going forward).
 *
 * The cascade is driven by PSGC *codes* internally (each level's children are queried by their
 * parent's code), but `value`/`onChange` only ever carry the resolved *names* — the shape
 * `Address`/`Borrower` already store on the wire. Because of that, this component can't pre-select
 * an existing text-only address (e.g. "CAVITE") back into its code-based dropdowns without a
 * reverse name->code lookup this API doesn't offer — the caller is expected to show the current
 * address as read-only context alongside this picker, which only ever produces a new selection.
 */
export function PsgcAddressPicker({ value, onChange }: { value: AddressDraft; onChange: (patch: Partial<AddressDraft>) => void }) {
  const [regionCode, setRegionCode] = React.useState('');
  const [provinceCode, setProvinceCode] = React.useState('');
  const [cityCode, setCityCode] = React.useState('');

  const regionsQuery = usePsgcOptions('/psgc/regions', true);
  const provincesQuery = usePsgcOptions(`/psgc/provinces?regionCode=${regionCode}`, Boolean(regionCode));
  const citiesQuery = usePsgcOptions(`/psgc/cities?provinceCode=${provinceCode}`, Boolean(provinceCode));
  const barangaysQuery = usePsgcOptions(`/psgc/barangays?cityMunicipalityCode=${cityCode}`, Boolean(cityCode));

  const pickRegion = (code: string) => {
    setRegionCode(code);
    setProvinceCode('');
    setCityCode('');
    onChange({ province: '', cityMunicipality: '', barangay: '' });
  };

  const pickProvince = (code: string) => {
    setProvinceCode(code);
    setCityCode('');
    const name = provincesQuery.data?.find((p) => p.code === code)?.name ?? '';
    onChange({ province: name, cityMunicipality: '', barangay: '' });
  };

  const pickCity = (code: string) => {
    setCityCode(code);
    const name = citiesQuery.data?.find((c) => c.code === code)?.name ?? '';
    onChange({ cityMunicipality: name, barangay: '' });
  };

  const pickBarangay = (code: string) => {
    const name = barangaysQuery.data?.find((b) => b.code === code)?.name ?? '';
    onChange({ barangay: name });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Region</Label>
          <Select value={regionCode} onValueChange={pickRegion}>
            <SelectTrigger>
              <SelectValue placeholder={regionsQuery.isLoading ? 'Loading…' : 'Select region'} />
            </SelectTrigger>
            <SelectContent>
              {(regionsQuery.data ?? []).map((r) => (
                <SelectItem key={r.code} value={r.code}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Province</Label>
          <Select value={provinceCode} onValueChange={pickProvince} disabled={!regionCode}>
            <SelectTrigger>
              <SelectValue placeholder={!regionCode ? 'Select a region first' : provincesQuery.isLoading ? 'Loading…' : 'Select province'} />
            </SelectTrigger>
            <SelectContent>
              {(provincesQuery.data ?? []).map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">City / Municipality</Label>
          <Select value={cityCode} onValueChange={pickCity} disabled={!provinceCode}>
            <SelectTrigger>
              <SelectValue placeholder={!provinceCode ? 'Select a province first' : citiesQuery.isLoading ? 'Loading…' : 'Select city/municipality'} />
            </SelectTrigger>
            <SelectContent>
              {(citiesQuery.data ?? []).map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Barangay</Label>
          <Select onValueChange={pickBarangay} disabled={!cityCode}>
            <SelectTrigger>
              <SelectValue placeholder={!cityCode ? 'Select a city/municipality first' : barangaysQuery.isLoading ? 'Loading…' : 'Select barangay'} />
            </SelectTrigger>
            <SelectContent>
              {(barangaysQuery.data ?? []).map((b) => (
                <SelectItem key={b.code} value={b.code}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">House / Unit / Bldg. No.</Label>
          <Input value={value.houseUnitNumber} onChange={(e) => onChange({ houseUnitNumber: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Street</Label>
          <Input value={value.street} onChange={(e) => onChange({ street: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Zip Code</Label>
          <Input value={value.zipCode} onChange={(e) => onChange({ zipCode: e.target.value })} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Selected: {[value.barangay, value.cityMunicipality, value.province].filter(Boolean).join(', ') || 'Nothing selected yet'}
      </p>
    </div>
  );
}
