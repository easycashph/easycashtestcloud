import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/apiClient';
import type { PsgcCityOption, PsgcOption, ResolvedAddressCodes } from '@/lib/psgcApiTypes';
import { toProperCase } from '@/lib/utils';

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

function usePsgcOptions<T extends PsgcOption = PsgcOption>(path: string, enabled: boolean) {
  return useQuery({
    queryKey: ['psgc', path],
    queryFn: () => apiClient.get<{ items: T[] }>(path).then((r) => r.items),
    enabled,
  });
}

/**
 * Region -> Province -> City/Municipality -> Barangay cascading picker, backed by the real PSGC
 * reference data (`GET /psgc/regions|provinces|cities|barangays`) - replaces free-text address
 * entry so a value can never again be saved as a raw PSGC code instead of a name (see
 * scripts/fix-coded-addresses.ts for the data-quality issue this prevents going forward).
 *
 * The cascade is driven by PSGC *codes* internally (each level's children are queried by their
 * parent's code), but `value`/`onChange` only ever carry the resolved *names* - the shape
 * `Address`/`Borrower` already store on the wire. When `value` arrives already populated (e.g. an
 * existing loan application's address being carried into "Create Client Profile"), a one-time
 * reverse lookup (`GET /psgc/resolve-address`) resolves those names back to codes so the cascading
 * dropdowns pre-select the existing address instead of starting blank - without this, staff could
 * mistake a filled-in address for an empty one, and picking Region "to fill it in" would wipe the
 * province/city/barangay that were already there (see `pickRegion` below).
 */
export function PsgcAddressPicker({ value, onChange }: { value: AddressDraft; onChange: (patch: Partial<AddressDraft>) => void }) {
  const [regionCode, setRegionCode] = React.useState('');
  const [provinceCode, setProvinceCode] = React.useState('');
  const [cityCode, setCityCode] = React.useState('');
  const [barangayCode, setBarangayCode] = React.useState('');

  const regionsQuery = usePsgcOptions('/psgc/regions', true);
  const provincesQuery = usePsgcOptions(`/psgc/provinces?regionCode=${regionCode}`, Boolean(regionCode));
  const citiesQuery = usePsgcOptions<PsgcCityOption>(`/psgc/cities?provinceCode=${provinceCode}`, Boolean(provinceCode));
  const barangaysQuery = usePsgcOptions(`/psgc/barangays?cityMunicipalityCode=${cityCode}`, Boolean(cityCode));

  // One-time reverse lookup for an already-populated `value` - `enabled` turns itself off once
  // `regionCode` is set (whether from this resolution or from the user's own picks), so this never
  // fights a manual selection or refetches on every keystroke of the free-text fields below.
  const resolveQuery = useQuery({
    queryKey: ['psgc', 'resolve-address', value.province, value.cityMunicipality, value.barangay],
    queryFn: () =>
      apiClient.get<ResolvedAddressCodes>(
        `/psgc/resolve-address?province=${encodeURIComponent(value.province)}&cityMunicipality=${encodeURIComponent(value.cityMunicipality)}&barangay=${encodeURIComponent(value.barangay)}`,
      ),
    enabled: Boolean(value.province) && !regionCode,
  });
  React.useEffect(() => {
    if (!resolveQuery.data) return;
    if (resolveQuery.data.regionCode) setRegionCode(resolveQuery.data.regionCode);
    if (resolveQuery.data.provinceCode) setProvinceCode(resolveQuery.data.provinceCode);
    if (resolveQuery.data.cityMunicipalityCode) setCityCode(resolveQuery.data.cityMunicipalityCode);
    if (resolveQuery.data.barangayCode) setBarangayCode(resolveQuery.data.barangayCode);
  }, [resolveQuery.data]);

  const pickRegion = (code: string) => {
    setRegionCode(code);
    setProvinceCode('');
    setCityCode('');
    setBarangayCode('');
    onChange({ province: '', cityMunicipality: '', barangay: '' });
  };

  const pickProvince = (code: string) => {
    setProvinceCode(code);
    setCityCode('');
    setBarangayCode('');
    const name = toProperCase(provincesQuery.data?.find((p) => p.code === code)?.name ?? '');
    onChange({ province: name, cityMunicipality: '', barangay: '' });
  };

  const pickCity = (code: string) => {
    setCityCode(code);
    setBarangayCode('');
    const city = citiesQuery.data?.find((c) => c.code === code);
    const name = toProperCase(city?.name ?? '');
    // Best-effort suggestion (see scripts/import-ph-zip-codes.ts) - still a plain editable Input
    // below, so staff can correct it (e.g. a city spanning multiple ZIP codes).
    onChange({ cityMunicipality: name, barangay: '', zipCode: city?.zipCode ?? '' });
  };

  const pickBarangay = (code: string) => {
    setBarangayCode(code);
    const name = toProperCase(barangaysQuery.data?.find((b) => b.code === code)?.name ?? '');
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
                  {toProperCase(r.name)}
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
                  {toProperCase(p.name)}
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
                  {toProperCase(c.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Barangay</Label>
          <Select value={barangayCode} onValueChange={pickBarangay} disabled={!cityCode}>
            <SelectTrigger>
              <SelectValue placeholder={!cityCode ? 'Select a city/municipality first' : barangaysQuery.isLoading ? 'Loading…' : 'Select barangay'} />
            </SelectTrigger>
            <SelectContent>
              {(barangaysQuery.data ?? []).map((b) => (
                <SelectItem key={b.code} value={b.code}>
                  {toProperCase(b.name)}
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
        Selected:{' '}
        {[value.barangay, value.cityMunicipality, value.province].filter(Boolean).map(toProperCase).join(', ') || 'Nothing selected yet'}
      </p>
    </div>
  );
}
